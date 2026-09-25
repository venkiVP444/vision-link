package com.visionlinkmobile

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import android.content.Context
import android.util.Log
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.nio.charset.StandardCharsets
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.pow
import kotlin.math.sin

/**
 * Offline Piper Neural Text-to-Speech Engine for Hausa
 *
 * Uses Microsoft ONNX Runtime Mobile to run the approved Murya Piper Hausa VITS ONNX model.
 * Executes 100% on-device on CPU with zero cloud/network dependency.
 *
 * Primary Voice: Persona Malama Asabe (Female Speaker F4, sid = 3)
 * Sample Rate: 22,050 Hz
 */
class PiperHausaEngine private constructor(private val context: Context) {

    companion object {
        private const val TAG = "PiperHausaEngine"
        private const val ASSET_DIR = "offline_tts/hausa"
        private const val MODEL_FILENAME = "model.onnx"
        private const val CONFIG_FILENAME = "model.onnx.json"
        const val SAMPLE_RATE = 22050

        // Speaker ID 3 is F4 (Malama Asabe persona: warm, soothing, natural)
        // Speaker ID 0 is F2 (brighter, crisp articulation)
        const val DEFAULT_SPEAKER_ID = 3L // F4

        @Volatile
        private var INSTANCE: PiperHausaEngine? = null

        fun getInstance(context: Context): PiperHausaEngine {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: PiperHausaEngine(context.applicationContext).also { INSTANCE = it }
            }
        }
    }

    private var ortEnv: OrtEnvironment? = null
    private var ortSession: OrtSession? = null
    private val phonemeIdMap = HashMap<String, Long>()
    private val audioTrackPlayer = AudioTrackPlayer(context)
    private val isInitialized = AtomicBoolean(false)
    private val isSpeaking = AtomicBoolean(false)
    private val isStopping = AtomicBoolean(false)
    private val executor = Executors.newSingleThreadExecutor()

    var activeSpeakerId: Long = DEFAULT_SPEAKER_ID

    interface Callback {
        fun onStart(utteranceId: String)
        fun onDone(utteranceId: String)
        fun onError(utteranceId: String, stage: String, errorCode: String, message: String)
    }

    /**
     * Initializes the ONNX Runtime session and phoneme mapping.
     */
    @Synchronized
    fun initialize(): Boolean {
        if (isInitialized.get()) {
            return true
        }

        try {
            val startTime = System.currentTimeMillis()
            Log.d(TAG, "Initializing Piper Hausa Engine...")

            // 1. Copy or verify model file in app files directory for direct native mmap
            val targetDir = File(context.filesDir, ASSET_DIR)
            if (!targetDir.exists()) {
                targetDir.mkdirs()
            }

            val modelFile = File(targetDir, MODEL_FILENAME)
            copyAssetIfNeeded("$ASSET_DIR/$MODEL_FILENAME", modelFile)

            // 2. Load configuration JSON to parse phoneme mapping
            val configContent = context.assets.open("$ASSET_DIR/$CONFIG_FILENAME").bufferedReader(StandardCharsets.UTF_8).use {
                it.readText()
            }
            parseConfig(configContent)

            // 3. Initialize ONNX Runtime
            val env = OrtEnvironment.getEnvironment("PiperHausa")
            ortEnv = env

            val sessionOptions = OrtSession.SessionOptions().apply {
                setIntraOpNumThreads(2) // Optimal for mobile ARM cores without thermal throttling
                setOptimizationLevel(OrtSession.SessionOptions.OptLevel.BASIC_OPT)
            }

            ortSession = env.createSession(modelFile.absolutePath, sessionOptions)
            isInitialized.set(true)

            val elapsed = System.currentTimeMillis() - startTime
            Log.i(TAG, "ONNX_INIT: SUCCESS. Piper Hausa Engine initialized in ${elapsed}ms. Model: ${modelFile.absolutePath}")
            return true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize Piper Hausa Engine: ${e.message}", e)
            isInitialized.set(false)
            return false
        }
    }

    private fun parseConfig(jsonStr: String) {
        val root = JSONObject(jsonStr)
        val idMapObj = root.optJSONObject("phoneme_id_map")
        if (idMapObj != null) {
            phonemeIdMap.clear()
            val keys = idMapObj.keys()
            while (keys.hasNext()) {
                val key = keys.next()
                val arr = idMapObj.optJSONArray(key)
                if (arr != null && arr.length() > 0) {
                    phonemeIdMap[key] = arr.getLong(0)
                }
            }
        }
        Log.d(TAG, "Loaded ${phonemeIdMap.size} phoneme token mappings from config")
    }

    private fun copyAssetIfNeeded(assetPath: String, targetFile: File) {
        if (targetFile.exists() && ModelVerifier.verifyChecksum(targetFile, ModelVerifier.SHA256_HAUSA)) {
            Log.d(TAG, "MODEL_VERIFY: SUCCESS. Existing Hausa model verified with SHA-256: ${targetFile.absolutePath}")
            return
        }

        Log.d(TAG, "Extracting asset $assetPath to ${targetFile.absolutePath}...")
        val inputStream: InputStream = context.assets.open(assetPath)
        val tempFile = File(targetFile.parentFile, targetFile.name + ".tmp")
        if (tempFile.exists()) {
            tempFile.delete()
        }
        val outputStream = FileOutputStream(tempFile)

        val buffer = ByteArray(64 * 1024)
        var bytesRead: Int
        while (inputStream.read(buffer).also { bytesRead = it } != -1) {
            outputStream.write(buffer, 0, bytesRead)
        }
        outputStream.flush()
        outputStream.close()
        inputStream.close()

        // Verify SHA-256 checksum on extracted temporary file before moving
        if (!ModelVerifier.verifyChecksum(tempFile, ModelVerifier.SHA256_HAUSA)) {
            tempFile.delete()
            throw IllegalStateException(
                "Hausa Piper model SHA-256 checksum mismatch! Expected: ${ModelVerifier.SHA256_HAUSA}"
            )
        }

        if (targetFile.exists()) {
            targetFile.delete()
        }
        val moved = tempFile.renameTo(targetFile)
        if (!moved) {
            throw IllegalStateException("Failed to atomically move temporary model to ${targetFile.absolutePath}")
        }
        Log.i(TAG, "MODEL_VERIFY: SUCCESS. Hausa model extracted and SHA-256 verified (${targetFile.length() / (1024 * 1024)} MB)")
    }

    fun isReady(): Boolean = isInitialized.get()

    /**
     * Converts Hausa text to a sequence of token IDs based on the Piper text phonemizer.
     * Intersperse format: [BOS(^), char1, PAD(_), char2, PAD(_), ..., EOS($)]
     */
    fun textToTokenIds(text: String): LongArray {
        val ids = ArrayList<Long>()
        val bos = phonemeIdMap["^"] ?: 1L
        val eos = phonemeIdMap["$"] ?: 2L
        val pad = phonemeIdMap["_"] ?: 0L

        ids.add(bos)

        val normalized = text.lowercase()
        var i = 0
        while (i < normalized.length) {
            val codePoint = normalized.codePointAt(i)
            val charCount = Character.charCount(codePoint)
            val chStr = String(Character.toChars(codePoint))
            i += charCount

            // Check if character is directly in mapping (e.g. standard a-z, hooked letters ƙ, ƴ, ɓ, ɗ)
            var token = phonemeIdMap[chStr]
            if (token == null) {
                // Fallback for accented vowels
                token = when (chStr) {
                    "à", "á", "â", "ã" -> phonemeIdMap["a"]
                    "è", "é", "ê", "ë" -> phonemeIdMap["e"]
                    "ì", "í", "î", "ï" -> phonemeIdMap["i"]
                    "ò", "ó", "ô", "õ" -> phonemeIdMap["o"]
                    "ù", "ú", "û", "ü" -> phonemeIdMap["u"]
                    else -> null
                }
            }

            if (token != null) {
                ids.add(token)
                ids.add(pad)
            }
        }

        ids.add(eos)
        return ids.toLongArray()
    }

    /**
     * Synthesizes and speaks text asynchronously.
     */
    fun speak(text: String, utteranceId: String, callback: Callback?) {
        executor.execute {
            if (!isInitialized.get()) {
                val ok = initialize()
                if (!ok) {
                    callback?.onError(utteranceId, "ONNX_INIT", "INIT_FAILED", "Piper Hausa engine initialization failed")
                    return@execute
                }
            }

            val session = ortSession
            val env = ortEnv
            if (session == null || env == null) {
                callback?.onError(utteranceId, "ONNX_INIT", "SESSION_NULL", "ONNX Runtime session is null")
                return@execute
            }

            isStopping.set(false)
            audioTrackPlayer.stop()

            try {
                isSpeaking.set(true)

                val tokenIds = textToTokenIds(text)
                if (tokenIds.isEmpty()) {
                    isSpeaking.set(false)
                    callback?.onDone(utteranceId)
                    return@execute
                }

                val numTokens = tokenIds.size.toLong()
                val token2d = arrayOf(tokenIds) // shape: [1, numTokens]

                val inputTensor = OnnxTensor.createTensor(env, token2d)
                val inputLengthsTensor = OnnxTensor.createTensor(env, longArrayOf(numTokens))
                val scalesTensor = OnnxTensor.createTensor(env, floatArrayOf(0.667f, 1.0f, 0.8f))
                val sidTensor = OnnxTensor.createTensor(env, longArrayOf(activeSpeakerId))

                val inputs = mapOf(
                    "input" to inputTensor,
                    "input_lengths" to inputLengthsTensor,
                    "scales" to scalesTensor,
                    "sid" to sidTensor
                )

                val startTime = System.currentTimeMillis()
                val result = session.run(inputs)
                val elapsedInference = System.currentTimeMillis() - startTime
                Log.d(TAG, "INFERENCE: SUCCESS. Completed in ${elapsedInference}ms for utterance: $utteranceId (${text.length} chars)")

                // Cleanup input tensors
                inputTensor.close()
                inputLengthsTensor.close()
                scalesTensor.close()
                sidTensor.close()

                if (isStopping.get()) {
                    isSpeaking.set(false)
                    result.close()
                    callback?.onDone(utteranceId)
                    return@execute
                }

                // Safe tensor float extraction using floatBuffer
                val outTensor = result.get(0) as OnnxTensor
                val floatBuffer = outTensor.floatBuffer
                val audioFloats = FloatArray(floatBuffer.remaining())
                floatBuffer.get(audioFloats)
                result.close()

                if (audioFloats.isEmpty()) {
                    isSpeaking.set(false)
                    callback?.onDone(utteranceId)
                    return@execute
                }

                // Apply real-time voice optimization
                val optimizedAudio = optimizeSpeechAudio(audioFloats, SAMPLE_RATE)

                if (isStopping.get()) {
                    isSpeaking.set(false)
                    callback?.onDone(utteranceId)
                    return@execute
                }

                // Convert to 16-bit PCM
                val pcm16 = ShortArray(optimizedAudio.size)
                for (i in optimizedAudio.indices) {
                    val s = (optimizedAudio[i] * 32767f).toInt().coerceIn(-32768, 32767)
                    pcm16[i] = s.toShort()
                }

                Log.d(TAG, "PCM_BYTES: ${pcm16.size * 2} (${pcm16.size} samples @ $SAMPLE_RATE Hz)")

                // Play PCM audio via shared AudioTrackPlayer
                audioTrackPlayer.playPcm(pcm16, SAMPLE_RATE, utteranceId, object : AudioTrackPlayer.PlaybackCallback {
                    override fun onStart(utteranceId: String) {
                        callback?.onStart(utteranceId)
                    }

                    override fun onDone(utteranceId: String) {
                        isSpeaking.set(false)
                        callback?.onDone(utteranceId)
                    }

                    override fun onError(utteranceId: String, stage: String, errorCode: String, message: String) {
                        isSpeaking.set(false)
                        callback?.onError(utteranceId, stage, errorCode, message)
                    }
                })

            } catch (e: Exception) {
                Log.e(TAG, "Synthesis or playback failed: ${e.message}", e)
                isSpeaking.set(false)
                callback?.onError(utteranceId, "SYNTHESIS", "SYNTHESIS_ERROR", e.message ?: "Synthesis failed")
            }
        }
    }

    /**
     * Real-time audio optimization pipeline tailored for female speech clarity.
     */
    private fun optimizeSpeechAudio(input: FloatArray, sr: Int): FloatArray {
        val n = input.size
        val output = FloatArray(n)

        // 1. High-Pass Filter (85 Hz, 2nd order Butterworth)
        val w0Hp = 2.0 * PI * 85.0 / sr
        val alphaHp = sin(w0Hp) / (2.0 * 0.7071)
        val cosW0Hp = cos(w0Hp)
        val b0Hp = ((1.0 + cosW0Hp) / 2.0).toFloat()
        val b1Hp = (-(1.0 + cosW0Hp)).toFloat()
        val b2Hp = ((1.0 + cosW0Hp) / 2.0).toFloat()
        val a0Hp = (1.0 + alphaHp).toFloat()
        val a1Hp = (-2.0 * cosW0Hp).toFloat()
        val a2Hp = (1.0 - alphaHp).toFloat()

        var x1 = 0f; var x2 = 0f; var y1 = 0f; var y2 = 0f
        for (i in 0 until n) {
            val x0 = input[i]
            val y0 = (b0Hp * x0 + b1Hp * x1 + b2Hp * x2 - a1Hp * y1 - a2Hp * y2) / a0Hp
            output[i] = y0
            x2 = x1; x1 = x0; y2 = y1; y1 = y0
        }

        // 2. Presence Peaking Filter (3200 Hz, Gain = +2.2 dB, Q = 1.0)
        val w0Pr = 2.0 * PI * 3200.0 / sr
        val alphaPr = sin(w0Pr) / (2.0 * 1.0)
        val cosW0Pr = cos(w0Pr)
        val aPrVal = 10.0.pow(2.2 / 40.0)
        val b0Pr = (1.0 + alphaPr * aPrVal).toFloat()
        val b1Pr = (-2.0 * cosW0Pr).toFloat()
        val b2Pr = (1.0 - alphaPr * aPrVal).toFloat()
        val a0Pr = (1.0 + alphaPr / aPrVal).toFloat()
        val a1Pr = (-2.0 * cosW0Pr).toFloat()
        val a2Pr = (1.0 - alphaPr / aPrVal).toFloat()

        x1 = 0f; x2 = 0f; y1 = 0f; y2 = 0f
        for (i in 0 until n) {
            val x0 = output[i]
            val y0 = (b0Pr * x0 + b1Pr * x1 + b2Pr * x2 - a1Pr * y1 - a2Pr * y2) / a0Pr
            output[i] = y0
            x2 = x1; x1 = x0; y2 = y1; y1 = y0
        }

        // 3. Notch Filter at 320 Hz (Cut muddiness, Gain = -1.5 dB, Q = 1.2)
        val w0Nt = 2.0 * PI * 320.0 / sr
        val alphaNt = sin(w0Nt) / (2.0 * 1.2)
        val cosW0Nt = cos(w0Nt)
        val aNtVal = 10.0.pow(-1.5 / 40.0)
        val b0Nt = (1.0 - alphaNt * aNtVal).toFloat()
        val b1Nt = (-2.0 * cosW0Nt).toFloat()
        val b2Nt = (1.0 + alphaNt * aNtVal).toFloat()
        val a0Nt = (1.0 + alphaNt / aNtVal).toFloat()
        val a1Nt = (-2.0 * cosW0Nt).toFloat()
        val a2Nt = (1.0 - alphaNt / aNtVal).toFloat()

        x1 = 0f; x2 = 0f; y1 = 0f; y2 = 0f
        for (i in 0 until n) {
            val x0 = output[i]
            val y0 = (b0Nt * x0 + b1Nt * x1 + b2Nt * x2 - a1Nt * y1 - a2Nt * y2) / a0Nt
            output[i] = y0
            x2 = x1; x1 = x0; y2 = y1; y1 = y0
        }

        // 4. Soft-knee compression and peak normalization to -1.0 dBFS (0.891)
        var maxVal = 0f
        for (i in 0 until n) {
            val absVal = kotlin.math.abs(output[i])
            if (absVal > maxVal) maxVal = absVal
        }

        val targetPeak = 0.891f
        if (maxVal > 0.0001f) {
            val scale = targetPeak / maxVal
            for (i in 0 until n) {
                var s = output[i] * scale
                if (s > 0.95f) {
                    s = 0.95f + 0.05f * kotlin.math.tanh((s - 0.95f) / 0.05f)
                } else if (s < -0.95f) {
                    s = -0.95f + 0.05f * kotlin.math.tanh((s + 0.95f) / 0.05f)
                }
                output[i] = s
            }
        }

        return output
    }

    fun stop() {
        isStopping.set(true)
        audioTrackPlayer.stop()
        isSpeaking.set(false)
    }

    fun isSpeakingNow(): Boolean = isSpeaking.get() || audioTrackPlayer.isPlaying()
}
