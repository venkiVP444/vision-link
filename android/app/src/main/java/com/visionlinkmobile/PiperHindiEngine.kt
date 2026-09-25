package com.visionlinkmobile

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import android.content.Context
import android.util.Log
import org.json.JSONObject
import java.io.File
import java.nio.charset.StandardCharsets
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Offline Piper Neural Text-to-Speech Engine for Hindi (Priyamvada)
 *
 * Runs the verified rhasspy/piper-voices Priyamvada VITS ONNX model.
 * Executes 100% on-device on CPU with zero cloud/network dependency once installed.
 *
 * Primary Voice: Priyamvada
 * Sample Rate: 22,050 Hz
 */
class PiperHindiEngine private constructor(private val context: Context) {

    companion object {
        private const val TAG = "PiperHindiEngine"
        private const val PACK_DIR = "voice_packs/hindi"
        private const val MODEL_FILENAME = "model.onnx"
        private const val TOKENS_ASSET = "offline_tts/hindi_tokens.json"
        const val SAMPLE_RATE = 22050

        @Volatile
        private var INSTANCE: PiperHindiEngine? = null

        fun getInstance(context: Context): PiperHindiEngine {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: PiperHindiEngine(context.applicationContext).also { INSTANCE = it }
            }
        }
    }

    private var ortEnv: OrtEnvironment? = null
    private var ortSession: OrtSession? = null
    private val phraseTokenMap = HashMap<String, LongArray>()
    private val audioTrackPlayer = AudioTrackPlayer(context)
    private val isInitialized = AtomicBoolean(false)
    private val isSpeaking = AtomicBoolean(false)
    private val isStopping = AtomicBoolean(false)
    private val executor = Executors.newSingleThreadExecutor()

    interface Callback {
        fun onStart(utteranceId: String)
        fun onDone(utteranceId: String)
        fun onError(utteranceId: String, stage: String, errorCode: String, message: String)
    }

    fun getModelFile(): File {
        val targetDir = File(context.filesDir, PACK_DIR)
        return File(targetDir, MODEL_FILENAME)
    }

    fun isModelInstalledAndVerified(): Boolean {
        val file = getModelFile()
        return file.exists() && ModelVerifier.verifyChecksum(file, ModelVerifier.SHA256_HINDI)
    }

    @Synchronized
    fun initialize(): Boolean {
        if (isInitialized.get() && ortSession != null) {
            return true
        }

        try {
            val startTime = System.currentTimeMillis()
            Log.d(TAG, "Initializing Piper Hindi Engine...")

            val modelFile = getModelFile()
            if (!modelFile.exists()) {
                Log.w(TAG, "Hindi model file does not exist at ${modelFile.absolutePath}")
                return false
            }

            if (!ModelVerifier.verifyChecksum(modelFile, ModelVerifier.SHA256_HINDI)) {
                Log.e(TAG, "Hindi model failed SHA-256 verification!")
                return false
            }

            // Load token mappings from assets
            loadTokenMap()

            // Initialize ONNX Runtime
            val env = OrtEnvironment.getEnvironment("PiperHindi")
            ortEnv = env

            val sessionOptions = OrtSession.SessionOptions().apply {
                setIntraOpNumThreads(2)
                setOptimizationLevel(OrtSession.SessionOptions.OptLevel.BASIC_OPT)
            }

            ortSession = env.createSession(modelFile.absolutePath, sessionOptions)
            isInitialized.set(true)

            val elapsed = System.currentTimeMillis() - startTime
            Log.i(TAG, "ONNX_INIT: SUCCESS. Piper Hindi Engine initialized in ${elapsed}ms. Model: ${modelFile.absolutePath}")
            return true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize Piper Hindi Engine: ${e.message}", e)
            isInitialized.set(false)
            return false
        }
    }

    private fun loadTokenMap() {
        try {
            val content = context.assets.open(TOKENS_ASSET)
                .bufferedReader(StandardCharsets.UTF_8).use { it.readText() }
            val root = JSONObject(content)
            phraseTokenMap.clear()
            val keys = root.keys()
            while (keys.hasNext()) {
                val phrase = keys.next()
                val arr = root.getJSONArray(phrase)
                val list = LongArray(arr.length()) { i -> arr.getLong(i) }
                phraseTokenMap[phrase] = list
            }
            Log.d(TAG, "Loaded ${phraseTokenMap.size} precomputed token sequences for Hindi")
        } catch (e: Exception) {
            Log.w(TAG, "Could not load hindi_tokens.json: ${e.message}")
        }
    }

    fun isReady(): Boolean = isInitialized.get() && isModelInstalledAndVerified()

    fun textToTokenIds(text: String): LongArray {
        val trimmed = text.trim()
        val direct = phraseTokenMap[trimmed]
        if (direct != null) {
            return direct
        }

        // Try without trailing punctuation
        val stripped = trimmed.replace(Regex("[।?!:.,]+$"), "").trim()
        val directStripped = phraseTokenMap[stripped]
        if (directStripped != null) {
            return directStripped
        }

        // Tokenize word-by-word with precomputed tokens
        val words = stripped.split(Regex("\\s+")).filter { it.isNotBlank() }
        val ids = ArrayList<Long>()
        ids.add(1L) // BOS
        ids.add(0L) // PAD

        for ((index, word) in words.withIndex()) {
            val wordTokens = phraseTokenMap[word]
            if (wordTokens != null) {
                for (t in wordTokens) {
                    if (t != 1L && t != 2L) { // omit inner BOS/EOS
                        ids.add(t)
                    }
                }
            }
            if (index < words.size - 1) {
                ids.add(3L) // space
                ids.add(0L) // PAD
            }
        }
        ids.add(2L) // EOS

        return ids.toLongArray()
    }

    fun speak(text: String, utteranceId: String, callback: Callback?) {
        executor.execute {
            if (!isInitialized.get() || ortSession == null) {
                val ok = initialize()
                if (!ok) {
                    callback?.onError(utteranceId, "VOICE_PACK", "MODEL_NOT_READY", "Hindi voice pack is not installed or failed SHA-256 verification")
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
                val token2d = arrayOf(tokenIds)

                val inputTensor = OnnxTensor.createTensor(env, token2d)
                val inputLengthsTensor = OnnxTensor.createTensor(env, longArrayOf(numTokens))
                val scalesTensor = OnnxTensor.createTensor(env, floatArrayOf(0.667f, 1.0f, 0.8f))

                val inputs = mapOf(
                    "input" to inputTensor,
                    "input_lengths" to inputLengthsTensor,
                    "scales" to scalesTensor
                )

                val startTime = System.currentTimeMillis()
                val result = session.run(inputs)
                val elapsedInference = System.currentTimeMillis() - startTime
                Log.d(TAG, "INFERENCE: SUCCESS. Hindi synthesis completed in ${elapsedInference}ms for utterance: $utteranceId")

                inputTensor.close()
                inputLengthsTensor.close()
                scalesTensor.close()

                if (isStopping.get()) {
                    isSpeaking.set(false)
                    result.close()
                    callback?.onDone(utteranceId)
                    return@execute
                }

                // Safe tensor extraction
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

                // Peak normalization to -1.0 dBFS
                var maxVal = 0f
                for (i in audioFloats.indices) {
                    val a = kotlin.math.abs(audioFloats[i])
                    if (a > maxVal) maxVal = a
                }

                val targetPeak = 0.891f
                val scale = if (maxVal > 0.0001f) targetPeak / maxVal else 1.0f

                val pcm16 = ShortArray(audioFloats.size)
                for (i in audioFloats.indices) {
                    var s = audioFloats[i] * scale
                    if (s > 0.95f) s = 0.95f + 0.05f * kotlin.math.tanh((s - 0.95f) / 0.05f)
                    else if (s < -0.95f) s = -0.95f + 0.05f * kotlin.math.tanh((s + 0.95f) / 0.05f)
                    val sInt = (s * 32767f).toInt().coerceIn(-32768, 32767)
                    pcm16[i] = sInt.toShort()
                }

                Log.d(TAG, "PCM_BYTES: ${pcm16.size * 2} (${pcm16.size} samples @ $SAMPLE_RATE Hz)")

                if (isStopping.get()) {
                    isSpeaking.set(false)
                    callback?.onDone(utteranceId)
                    return@execute
                }

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
                Log.e(TAG, "Hindi synthesis or playback failed: ${e.message}", e)
                isSpeaking.set(false)
                callback?.onError(utteranceId, "SYNTHESIS", "SYNTHESIS_ERROR", e.message ?: "Hindi synthesis failed")
            }
        }
    }

    fun stop() {
        isStopping.set(true)
        audioTrackPlayer.stop()
        isSpeaking.set(false)
    }

    fun isSpeakingNow(): Boolean = isSpeaking.get() || audioTrackPlayer.isPlaying()
}
