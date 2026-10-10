package com.visionlinkmobile

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.SystemClock
import android.util.Base64
import android.util.Log
import com.facebook.react.bridge.*
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.facedetector.FaceDetector
import com.google.mediapipe.tasks.vision.facedetector.FaceDetectorResult
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class FaceDetectorModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "OfflineFaceAI"
        private const val MODEL_PATH = "models/face_detection_short_range.tflite"
        private const val DEFAULT_CONFIDENCE_THRESHOLD = 0.60f
    }

    private val faceExecutor: ExecutorService = Executors.newSingleThreadExecutor()
    private var faceDetector: FaceDetector? = null
    private var isInitialized = false
    private var initError: String? = null

    override fun getName(): String = "FaceDetectorModule"

    init {
        initializeFaceDetectorAsync()
    }

    private fun initializeFaceDetectorAsync() {
        faceExecutor.execute {
            try {
                loadFaceDetector()
            } catch (e: Exception) {
                Log.e(TAG, "[OfflineFaceAI] Failed to auto-initialize FaceDetector: ${e.message}", e)
                initError = e.message
            }
        }
    }

    @Synchronized
    private fun loadFaceDetector(): Boolean {
        if (isInitialized && faceDetector != null) {
            return true
        }
        return try {
            val baseOptions = BaseOptions.builder()
                .setModelAssetPath(MODEL_PATH)
                .build()

            val options = FaceDetector.FaceDetectorOptions.builder()
                .setBaseOptions(baseOptions)
                .setMinDetectionConfidence(0.50f)
                .setRunningMode(RunningMode.IMAGE)
                .build()

            faceDetector = FaceDetector.createFromOptions(reactContext, options)
            isInitialized = true
            initError = null
            Log.i(TAG, "[OfflineFaceAI] FaceDetector successfully initialized from $MODEL_PATH")
            true
        } catch (e: Exception) {
            Log.e(TAG, "[OfflineFaceAI] Error creating FaceDetector: ${e.message}", e)
            initError = e.message
            isInitialized = false
            false
        }
    }

    @ReactMethod
    fun isFaceDetectorLoaded(promise: Promise) {
        promise.resolve(isInitialized && faceDetector != null)
    }

    @ReactMethod
    fun detectFaces(imageInput: Dynamic, minConfidence: Double, promise: Promise) {
        faceExecutor.execute {
            try {
                if (!isInitialized || faceDetector == null) {
                    val loaded = loadFaceDetector()
                    if (!loaded || faceDetector == null) {
                        promise.reject("NOT_INITIALIZED", "FaceDetector could not be initialized: $initError")
                        return@execute
                    }
                }

                val activeDetector = faceDetector
                if (activeDetector == null) {
                    promise.reject("NOT_INITIALIZED", "FaceDetector is not available.")
                    return@execute
                }

                val frameInput = when (imageInput.type) {
                    ReadableType.Map -> {
                        val map = imageInput.asMap()
                        val data = map?.getString("data") ?: ""
                        val seq = if (map != null && map.hasKey("frameSequence")) map.getDouble("frameSequence").toLong() else 0L
                        val w = if (map != null && map.hasKey("width")) map.getInt("width") else 320
                        val h = if (map != null && map.hasKey("height")) map.getInt("height") else 240
                        TFLiteModule.FrameInputData(data, seq, w, h)
                    }
                    ReadableType.String -> {
                        TFLiteModule.FrameInputData(imageInput.asString() ?: "", 0L, 320, 240)
                    }
                    else -> {
                        promise.reject("INVALID_INPUT", "Expected base64 string or frame payload map.")
                        return@execute
                    }
                }

                if (frameInput.data.isBlank()) {
                    promise.reject("INVALID_INPUT", "Base64 image string is empty.")
                    return@execute
                }

                val cleanBase64 = if (frameInput.data.contains(",")) {
                    frameInput.data.substringAfter(",")
                } else {
                    frameInput.data
                }

                val imageBytes = try {
                    Base64.decode(cleanBase64, Base64.DEFAULT)
                } catch (e: Exception) {
                    promise.reject("DECODE_ERROR", "Failed to decode base64 image: ${e.message}")
                    return@execute
                }

                val bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size)
                if (bitmap == null) {
                    promise.reject("BITMAP_ERROR", "Failed to decode image bytes into Android Bitmap.")
                    return@execute
                }

                val startTime = SystemClock.elapsedRealtime()
                val mpImage = BitmapImageBuilder(bitmap).build()
                val detectionResult: FaceDetectorResult = try {
                    activeDetector.detect(mpImage)
                } catch (ex: Exception) {
                    bitmap.recycle()
                    promise.reject("INFERENCE_ERROR", "Face detection inference failed: ${ex.message}", ex)
                    return@execute
                }
                val inferenceTimeMs = SystemClock.elapsedRealtime() - startTime

                val threshold = if (minConfidence in 0.01..1.0) minConfidence.toFloat() else DEFAULT_CONFIDENCE_THRESHOLD
                val facesArray = Arguments.createArray()
                var primaryPosition = "ahead"
                var highestScore = 0.0f
                var detectedFaceCount = 0

                val imageWidth = bitmap.width.toFloat()
                val imageHeight = bitmap.height.toFloat()

                for (detection in detectionResult.detections()) {
                    val score = if (detection.categories().isNotEmpty()) {
                        detection.categories()[0].score()
                    } else {
                        1.0f
                    }

                    if (score < threshold) {
                        continue
                    }

                    detectedFaceCount++
                    val box = detection.boundingBox() // RectF in pixel coordinates

                    val xmin = (box.left / imageWidth).coerceIn(0.0f, 1.0f)
                    val ymin = (box.top / imageHeight).coerceIn(0.0f, 1.0f)
                    val xmax = (box.right / imageWidth).coerceIn(0.0f, 1.0f)
                    val ymax = (box.bottom / imageHeight).coerceIn(0.0f, 1.0f)

                    val centerX = (xmin + xmax) / 2.0f
                    val position = when {
                        centerX < 0.35f -> "left"
                        centerX > 0.65f -> "right"
                        else -> "ahead"
                    }

                    val faceMap = Arguments.createMap().apply {
                        putDouble("confidence", score.toDouble())
                        putString("position", position)
                        putString("label", "Face")
                        val boxMap = Arguments.createMap().apply {
                            putDouble("ymin", ymin.toDouble())
                            putDouble("xmin", xmin.toDouble())
                            putDouble("ymax", ymax.toDouble())
                            putDouble("xmax", xmax.toDouble())
                            putDouble("x", box.left.toDouble())
                            putDouble("y", box.top.toDouble())
                            putDouble("width", box.width().toDouble())
                            putDouble("height", box.height().toDouble())
                        }
                        putMap("boundingBox", boxMap)
                    }
                    facesArray.pushMap(faceMap)

                    if (score > highestScore) {
                        highestScore = score
                        primaryPosition = position
                    }
                }

                bitmap.recycle()

                val warning = if (detectedFaceCount > 0) {
                    if (primaryPosition == "left") "Face on your left"
                    else if (primaryPosition == "right") "Face on your right"
                    else "Face ahead, be careful"
                } else {
                    null
                }

                Log.i(TAG, "[OfflineFaceAI] faces=$detectedFaceCount (Inference: ${inferenceTimeMs}ms, Warning: ${warning ?: "None"})")

                val resultMap = Arguments.createMap().apply {
                    putString("status", if (detectedFaceCount > 0) "success" else "no-face")
                    if (warning != null) {
                        putString("warning", warning)
                    } else {
                        putNull("warning")
                    }
                    putArray("faces", facesArray)
                    putDouble("inferenceTimeMs", inferenceTimeMs.toDouble())
                    putDouble("timestamp", System.currentTimeMillis().toDouble())
                    putString("model", "MediaPipe BlazeFace (100% Offline)")
                }

                promise.resolve(resultMap)
            } catch (e: Exception) {
                Log.e(TAG, "[OfflineFaceAI] Unhandled error during face detection: ${e.message}", e)
                promise.reject("DETECTION_ERROR", e.message, e)
            }
        }
    }
}
