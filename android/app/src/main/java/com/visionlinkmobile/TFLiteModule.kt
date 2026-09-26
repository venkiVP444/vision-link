package com.visionlinkmobile

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.SystemClock
import android.util.Base64
import android.util.Log
import com.facebook.react.bridge.*
import org.tensorflow.lite.Interpreter
import java.io.FileInputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.MappedByteBuffer
import java.nio.channels.FileChannel

class TFLiteModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "OfflineAI"
        private const val MODEL_PATH = "models/ssd_mobilenet_v1.tflite"
        private const val LABELS_PATH = "models/labels.txt"
        private const val INPUT_SIZE = 300
        private const val NUM_CHANNELS = 3
        private const val MAX_DETECTIONS = 10
        private const val DEFAULT_CONFIDENCE_THRESHOLD = 0.50f

        val ESSENTIAL_OBJECT_ALLOWLIST = setOf(
            "person", "car", "motorcycle", "bicycle", "bus", "truck",
            "stop sign", "fire hydrant", "bench", "dog", "chair", "couch",
            "dining table", "table", "bed", "toilet", "potted plant",
            "backpack", "umbrella", "suitcase", "tv"
        )
    }

    private var interpreter: Interpreter? = null
    private var labels: List<String> = emptyList()
    private var isInitialized = false
    private var modelInputWidth = INPUT_SIZE
    private var modelInputHeight = INPUT_SIZE
    private var modelChannels = NUM_CHANNELS
    private var modelDataType = org.tensorflow.lite.DataType.UINT8

    override fun getName(): String = "TFLiteModule"

    init {
        initializeDetectorAsync()
    }

    private fun initializeDetectorAsync() {
        Thread {
            try {
                loadModelAndLabels()
            } catch (e: Exception) {
                Log.e(TAG, "[OfflineAI] Failed to auto-initialize TFLite detector", e)
            }
        }.start()
    }

    @Synchronized
    private fun loadModelAndLabels() {
        if (isInitialized && interpreter != null) {
            return
        }

        Log.i(TAG, "[OfflineAI] Model loading from assets: $MODEL_PATH...")
        val modelBuffer = loadModelFile(reactContext, MODEL_PATH)

        val options = Interpreter.Options().apply {
            setNumThreads(4)
        }
        val interp = Interpreter(modelBuffer, options)
        interpreter = interp

        // Step 1: Inspect actual model input and output tensors
        val inTensor = interp.getInputTensor(0)
        val inShape = inTensor.shape()
        modelDataType = inTensor.dataType()
        if (inShape.size == 4) {
            modelInputHeight = inShape[1]
            modelInputWidth = inShape[2]
            modelChannels = inShape[3]
        }

        Log.i(TAG, "[TFLite] Input tensor shape = ${inShape.contentToString()}")
        Log.i(TAG, "[TFLite] Input type = $modelDataType")

        val outputCount = interp.outputTensorCount
        for (i in 0 until outputCount) {
            val outTensor = interp.getOutputTensor(i)
            Log.i(TAG, "[TFLite] Output tensor $i = ${outTensor.shape().contentToString()} ${outTensor.dataType()}")
        }

        labels = reactContext.assets.open(LABELS_PATH).bufferedReader().readLines()
        isInitialized = true
        Log.i(TAG, "[EdgeAI] Model loaded locally from assets: $MODEL_PATH (Input: ${modelInputWidth}x${modelInputHeight}x${modelChannels} $modelDataType, Classes: ${labels.size})")
    }

    private fun loadModelFile(context: Context, modelPath: String): MappedByteBuffer {
        val fileDescriptor = context.assets.openFd(modelPath)
        val inputStream = FileInputStream(fileDescriptor.fileDescriptor)
        val fileChannel = inputStream.channel
        val startOffset = fileDescriptor.startOffset
        val declaredLength = fileDescriptor.declaredLength
        return fileChannel.map(FileChannel.MapMode.READ_ONLY, startOffset, declaredLength)
    }

    @ReactMethod
    fun loadModel(promise: Promise) {
        try {
            loadModelAndLabels()
            val map = Arguments.createMap().apply {
                putBoolean("success", true)
                putString("model", MODEL_PATH)
                putInt("classesCount", labels.size)
                putString("inputSize", "${INPUT_SIZE}x${INPUT_SIZE}")
            }
            promise.resolve(map)
        } catch (e: Exception) {
            Log.e(TAG, "[OfflineAI] loadModel error", e)
            promise.reject("MODEL_LOAD_FAILED", "Failed to load TFLite model: ${e.message}", e)
        }
    }

    @ReactMethod
    fun isModelLoaded(promise: Promise) {
        promise.resolve(isInitialized && interpreter != null)
    }

    @ReactMethod
    fun getModelInfo(promise: Promise) {
        val map = Arguments.createMap().apply {
            putBoolean("isLoaded", isInitialized && interpreter != null)
            putString("modelName", "SSD MobileNet v1 (100% Offline)")
            putString("modelAsset", MODEL_PATH)
            putString("inputShape", "1x${INPUT_SIZE}x${INPUT_SIZE}x${NUM_CHANNELS}")
            putString("inputDataType", "UINT8")
            putInt("maxDetections", MAX_DETECTIONS)
            putInt("totalClasses", labels.size)
        }
        promise.resolve(map)
    }

    data class FrameInputData(val data: String, val frameSequence: Long, val width: Int, val height: Int)

    @ReactMethod
    fun detectObjects(imageInput: Dynamic, minConfidence: Double, promise: Promise) {
        Thread {
            try {
                if (!isInitialized || interpreter == null) {
                    loadModelAndLabels()
                }

                val activeInterpreter = interpreter
                if (activeInterpreter == null) {
                    promise.reject("NOT_INITIALIZED", "TFLite interpreter is not available.")
                    return@Thread
                }

                val frameInput = when (imageInput.type) {
                    ReadableType.Map -> {
                        val map = imageInput.asMap()
                        val data = map?.getString("data") ?: ""
                        val seq = if (map != null && map.hasKey("frameSequence")) map.getDouble("frameSequence").toLong() else 0L
                        val w = if (map != null && map.hasKey("width")) map.getInt("width") else 320
                        val h = if (map != null && map.hasKey("height")) map.getInt("height") else 240
                        FrameInputData(data, seq, w, h)
                    }
                    ReadableType.String -> {
                        FrameInputData(imageInput.asString() ?: "", 0L, 320, 240)
                    }
                    else -> {
                        promise.reject("INVALID_INPUT", "Expected base64 string or frame payload map.")
                        return@Thread
                    }
                }

                if (frameInput.data.isBlank()) {
                    promise.reject("INVALID_INPUT", "Base64 image string is empty.")
                    return@Thread
                }

                // Clean Base64 data header if present (e.g. data:image/jpeg;base64,...)
                val cleanBase64 = if (frameInput.data.contains(",")) {
                    frameInput.data.substringAfter(",")
                } else {
                    frameInput.data
                }

                val imageBytes = try {
                    Base64.decode(cleanBase64, Base64.DEFAULT)
                } catch (e: Exception) {
                    promise.reject("DECODE_ERROR", "Failed to decode base64 image: ${e.message}")
                    return@Thread
                }

                val bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size)
                if (bitmap == null) {
                    promise.reject("BITMAP_ERROR", "Failed to decode image bytes into Android Bitmap.")
                    return@Thread
                }

                // Step 4: Resize to model's actual input dimensions
                Log.i(TAG, "[EdgeAI] Source bitmap = ${bitmap.width}x${bitmap.height}")
                Log.i(TAG, "[EdgeAI] Model input bitmap = ${modelInputWidth}x${modelInputHeight}")

                val resizedBitmap = Bitmap.createScaledBitmap(bitmap, modelInputWidth, modelInputHeight, true)
                if (bitmap != resizedBitmap) {
                    bitmap.recycle()
                }

                // Step 5: Fix input byte buffer
                val isFloat = modelDataType == org.tensorflow.lite.DataType.FLOAT32
                val bytesPerChannel = if (isFloat) 4 else 1

                val inputBuffer = ByteBuffer.allocateDirect(1 * modelInputWidth * modelInputHeight * modelChannels * bytesPerChannel).apply {
                    order(ByteOrder.nativeOrder())
                }

                val intValues = IntArray(modelInputWidth * modelInputHeight)
                resizedBitmap.getPixels(intValues, 0, modelInputWidth, 0, 0, modelInputWidth, modelInputHeight)
                resizedBitmap.recycle()

                if (isFloat) {
                    for (pixelValue in intValues) {
                        val r = ((pixelValue shr 16) and 0xFF).toFloat()
                        val g = ((pixelValue shr 8) and 0xFF).toFloat()
                        val b = (pixelValue and 0xFF).toFloat()
                        inputBuffer.putFloat((r - 127.5f) / 127.5f)
                        inputBuffer.putFloat((g - 127.5f) / 127.5f)
                        inputBuffer.putFloat((b - 127.5f) / 127.5f)
                    }
                } else {
                    for (pixelValue in intValues) {
                        inputBuffer.put(((pixelValue shr 16) and 0xFF).toByte())
                        inputBuffer.put(((pixelValue shr 8) and 0xFF).toByte())
                        inputBuffer.put((pixelValue and 0xFF).toByte())
                    }
                }
                inputBuffer.rewind()

                // Step 5 requirement logs:
                Log.i(TAG, "[EdgeAI] Running inference frameSeq=${frameInput.frameSequence}")
                Log.i(TAG, "[EdgeAI] inputBuffer position=${inputBuffer.position()}")
                Log.i(TAG, "[EdgeAI] inputBuffer capacity=${inputBuffer.capacity()}")

                // Step 7: Verify output tensors
                // Output 0: Bounding boxes [1, 10, 4]
                // Output 1: Classes [1, 10]
                // Output 2: Scores [1, 10]
                // Output 3: Num detections [1]
                val outputBoxes = Array(1) { Array(MAX_DETECTIONS) { FloatArray(4) } }
                val outputClasses = Array(1) { FloatArray(MAX_DETECTIONS) }
                val outputScores = Array(1) { FloatArray(MAX_DETECTIONS) }
                val numDetections = FloatArray(1)

                val outputMap = HashMap<Int, Any>()
                outputMap[0] = outputBoxes
                outputMap[1] = outputClasses
                outputMap[2] = outputScores
                outputMap[3] = numDetections

                Log.i(TAG, "[EdgeAI] TFLite inference started")

                // Step 6: Verify tflite.run() with error handling
                val startTime = SystemClock.elapsedRealtime()
                try {
                    activeInterpreter.runForMultipleInputsOutputs(arrayOf(inputBuffer), outputMap)
                } catch (tfliteEx: Exception) {
                    Log.e(TAG, "[EdgeAI] TFLite inference FAILED: ${tfliteEx.message}", tfliteEx)
                    promise.reject("TFLITE_INFERENCE_FAILED", "[EdgeAI] TFLite inference FAILED: ${tfliteEx.message}", tfliteEx)
                    return@Thread
                }
                val inferenceTimeMs = SystemClock.elapsedRealtime() - startTime

                val threshold = if (minConfidence in 0.01..1.0) minConfidence.toFloat() else DEFAULT_CONFIDENCE_THRESHOLD
                val rawDetectionCount = numDetections[0].toInt().coerceIn(0, MAX_DETECTIONS)

                var bestScore = 0.0f
                var bestClassId = -1

                for (i in 0 until rawDetectionCount) {
                    val s = outputScores[0][i]
                    if (s > bestScore) {
                        bestScore = s
                        bestClassId = outputClasses[0][i].toInt()
                    }
                }

                // Step 7 requirement logs:
                Log.i(TAG, "[EdgeAI] inference completed")
                Log.i(TAG, "[EdgeAI] detectionCount=$rawDetectionCount")
                Log.i(TAG, "[EdgeAI] bestScore=${String.format(java.util.Locale.US, "%.2f", bestScore)}")
                Log.i(TAG, "[EdgeAI] bestClassId=$bestClassId")

                val objectsArray = Arguments.createArray()
                var primaryLabel: String? = null
                var primaryPosition: String = "ahead"
                var highestScore = 0.0f

                for (i in 0 until rawDetectionCount) {
                    val score = outputScores[0][i]
                    if (score >= threshold) {
                        val classId = outputClasses[0][i].toInt()
                        // Category ID in labelmap is 1-based (index 0 is '???', index 1 is 'person')
                        if (classId !in 0 until (labels.size - 1)) {
                            Log.w(TAG, "[OfflineAI] Invalid classId=$classId (out of bounds). Skipping.")
                            continue
                        }
                        val rawLabel = labels[classId + 1].trim()
                        if (rawLabel == "???" || rawLabel.isBlank() || rawLabel.equals("object", ignoreCase = true)) {
                            Log.w(TAG, "[OfflineAI] Unmapped/unknown label for classId=$classId. Skipping.")
                            continue
                        }

                        // Step 8: Top-20 filter
                        val isAllowed = ESSENTIAL_OBJECT_ALLOWLIST.contains(rawLabel.lowercase())
                        val displayLabel = when (rawLabel.lowercase()) {
                            "dining table", "table" -> "Table"
                            "tv" -> "TV"
                            "stop sign" -> "Stop sign"
                            "fire hydrant" -> "Fire hydrant"
                            "potted plant" -> "Potted plant"
                            else -> rawLabel.replaceFirstChar { it.uppercase() }
                        }
                        val itemWarning = "$displayLabel ahead, be careful"

                        Log.i(TAG, """
[EdgeAI]
Class ID: $classId
Confidence: ${String.format(java.util.Locale.US, "%.2f", score)}
Label: $rawLabel
Allowed: $isAllowed
Warning: ${if (isAllowed) itemWarning else "None"}
TTS: ${if (isAllowed) itemWarning else "None"}
Camera Connection State: connected
""".trimIndent())

                        if (!isAllowed) {
                            Log.d(TAG, "[OfflineAI] Object '$rawLabel' (classId=$classId) not in essential allowlist. Ignoring.")
                            continue
                        }

                        val ymin = outputBoxes[0][i][0].coerceIn(0.0f, 1.0f)
                        val xmin = outputBoxes[0][i][1].coerceIn(0.0f, 1.0f)
                        val ymax = outputBoxes[0][i][2].coerceIn(0.0f, 1.0f)
                        val xmax = outputBoxes[0][i][3].coerceIn(0.0f, 1.0f)

                        val centerX = (xmin + xmax) / 2.0f
                        val position = when {
                            centerX < 0.35f -> "left"
                            centerX > 0.65f -> "right"
                            else -> "ahead"
                        }

                        val formattedLabel = displayLabel

                        val objMap = Arguments.createMap().apply {
                            putString("label", formattedLabel)
                            putDouble("confidence", score.toDouble())
                            putString("position", position)
                            putInt("classId", classId)
                            val boxMap = Arguments.createMap().apply {
                                putDouble("ymin", ymin.toDouble())
                                putDouble("xmin", xmin.toDouble())
                                putDouble("ymax", ymax.toDouble())
                                putDouble("xmax", xmax.toDouble())
                                putDouble("x", xmin.toDouble() * frameInput.width)
                                putDouble("y", ymin.toDouble() * frameInput.height)
                                putDouble("width", (xmax - xmin).toDouble() * frameInput.width)
                                putDouble("height", (ymax - ymin).toDouble() * frameInput.height)
                            }
                            putMap("boundingBox", boxMap)
                        }
                        objectsArray.pushMap(objMap)

                        if (score > highestScore) {
                            highestScore = score
                            primaryLabel = formattedLabel
                            primaryPosition = position
                        }
                    }
                }

                val detectionCount = objectsArray.size()
                Log.i(TAG, "[EdgeAI] TFLite output detections=$detectionCount")

                val warning = if (primaryLabel != null) {
                    "$primaryLabel ahead, be careful"
                } else {
                    null
                }

                if (warning != null) {
                    Log.i(TAG, "[EdgeAI] Final Warning: $warning")
                    Log.i(TAG, "[OfflineAI] Warning: $warning (Inference: ${inferenceTimeMs}ms)")
                }

                val resultMap = Arguments.createMap().apply {
                    putString("status", "success")
                    if (warning != null) {
                        putString("warning", warning)
                    } else {
                        putNull("warning")
                    }
                    putArray("objects", objectsArray)
                    putDouble("inferenceTimeMs", inferenceTimeMs.toDouble())
                    putDouble("timestamp", System.currentTimeMillis().toDouble())
                    putString("model", "SSD MobileNet v1 (100% Offline)")
                }

                promise.resolve(resultMap)

            } catch (e: Exception) {
                Log.e(TAG, "[OfflineAI] Inference error: ${e.message}", e)
                promise.reject("INFERENCE_ERROR", "Failed to run TFLite inference: ${e.message}", e)
            }
        }.start()
    }
}
