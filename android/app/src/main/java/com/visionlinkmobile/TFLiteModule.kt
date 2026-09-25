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
        interpreter = Interpreter(modelBuffer, options)

        labels = reactContext.assets.open(LABELS_PATH).bufferedReader().readLines()
        isInitialized = true
        Log.i(TAG, "[EdgeAI] Model loaded locally from assets: $MODEL_PATH (Input: ${INPUT_SIZE}x${INPUT_SIZE}x${NUM_CHANNELS} UINT8, Classes: ${labels.size})")
        Log.i(TAG, "[OfflineAI] Model loaded. Input: ${INPUT_SIZE}x${INPUT_SIZE}x${NUM_CHANNELS} UINT8. Total classes: ${labels.size}")
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

    @ReactMethod
    fun detectObjects(base64Image: String, minConfidence: Double, promise: Promise) {
        try {
            if (!isInitialized || interpreter == null) {
                loadModelAndLabels()
            }

            val activeInterpreter = interpreter
            if (activeInterpreter == null) {
                promise.reject("NOT_INITIALIZED", "TFLite interpreter is not available.")
                return
            }

            if (base64Image.isBlank()) {
                promise.reject("INVALID_INPUT", "Base64 image string is empty.")
                return
            }

            // Clean Base64 data header if present (e.g. data:image/jpeg;base64,...)
            val cleanBase64 = if (base64Image.contains(",")) {
                base64Image.substringAfter(",")
            } else {
                base64Image
            }

            val imageBytes = try {
                Base64.decode(cleanBase64, Base64.DEFAULT)
            } catch (e: Exception) {
                promise.reject("DECODE_ERROR", "Failed to decode base64 image: ${e.message}")
                return
            }

            val bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size)
            if (bitmap == null) {
                promise.reject("BITMAP_ERROR", "Failed to decode image bytes into Android Bitmap.")
                return
            }

            val resizedBitmap = Bitmap.createScaledBitmap(bitmap, INPUT_SIZE, INPUT_SIZE, true)

            // Prepare UINT8 ByteBuffer for model input [1, 300, 300, 3]
            val inputBuffer = ByteBuffer.allocateDirect(1 * INPUT_SIZE * INPUT_SIZE * NUM_CHANNELS).apply {
                order(ByteOrder.nativeOrder())
            }

            val intValues = IntArray(INPUT_SIZE * INPUT_SIZE)
            resizedBitmap.getPixels(intValues, 0, INPUT_SIZE, 0, 0, INPUT_SIZE, INPUT_SIZE)

            for (pixelValue in intValues) {
                inputBuffer.put(((pixelValue shr 16) and 0xFF).toByte())
                inputBuffer.put(((pixelValue shr 8) and 0xFF).toByte())
                inputBuffer.put((pixelValue and 0xFF).toByte())
            }
            inputBuffer.rewind()

            // Prepare 4 output tensors for TFLite_Detection_PostProcess
            // 0: Bounding boxes [1, 10, 4]
            // 1: Classes [1, 10]
            // 2: Scores [1, 10]
            // 3: Num detections [1]
            val outputBoxes = Array(1) { Array(MAX_DETECTIONS) { FloatArray(4) } }
            val outputClasses = Array(1) { FloatArray(MAX_DETECTIONS) }
            val outputScores = Array(1) { FloatArray(MAX_DETECTIONS) }
            val numDetections = FloatArray(1)

            val outputMap = HashMap<Int, Any>()
            outputMap[0] = outputBoxes
            outputMap[1] = outputClasses
            outputMap[2] = outputScores
            outputMap[3] = numDetections

            val startTime = SystemClock.elapsedRealtime()
            Log.i(TAG, "[EdgeAI] Running local inference on image buffer (${INPUT_SIZE}x${INPUT_SIZE})")
            activeInterpreter.runForMultipleInputsOutputs(arrayOf(inputBuffer), outputMap)
            val inferenceTimeMs = SystemClock.elapsedRealtime() - startTime

            val threshold = if (minConfidence in 0.01..1.0) minConfidence.toFloat() else DEFAULT_CONFIDENCE_THRESHOLD
            val rawDetectionCount = numDetections[0].toInt().coerceIn(0, MAX_DETECTIONS)

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

                    val isAllowed = ESSENTIAL_OBJECT_ALLOWLIST.contains(rawLabel.lowercase())
                    val displayLabel = when (rawLabel.lowercase()) {
                        "dining table", "table" -> "Table"
                        "tv" -> "TV"
                        "stop sign" -> "Stop sign"
                        "fire hydrant" -> "Fire hydrant"
                        "potted plant" -> "Potted plant"
                        else -> rawLabel.replaceFirstChar { it.uppercase() }
                    }
                    val itemWarning = "$displayLabel ahead. Be careful."

                    Log.i(TAG, """
[EdgeAI]
Class ID: $classId
Confidence: ${String.format("%.2f", score)}
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
                            putDouble("x", xmin.toDouble() * 320)
                            putDouble("y", ymin.toDouble() * 320)
                            putDouble("width", (xmax - xmin).toDouble() * 320)
                            putDouble("height", (ymax - ymin).toDouble() * 320)
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

            val warning = if (primaryLabel != null) {
                "$primaryLabel ahead. Be careful."
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
            Log.e(TAG, "[OfflineAI] Inference error", e)
            promise.reject("INFERENCE_ERROR", "Failed to run TFLite inference: ${e.message}", e)
        }
    }
}
