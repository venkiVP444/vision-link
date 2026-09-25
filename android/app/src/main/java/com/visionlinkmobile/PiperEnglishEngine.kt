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
 * Offline Piper Neural Text-to-Speech Engine for English (British Jenny Dioco)
 *
 * Runs the team-approved Candidate 02 model (en_GB-jenny_dioco-medium.onnx)
 * on Microsoft ONNX Runtime Mobile for Android.
 *
 * Primary Voice: Jenny Dioco (en-GB, Female)
 * Sample Rate: 22,050 Hz
 * License: CC BY-SA 4.0
 */
class PiperEnglishEngine private constructor(private val context: Context) {

    companion object {
        private const val TAG = "PiperEnglishEngine"
        private const val ASSET_DIR = "offline_tts/english"
        private const val MODEL_FILENAME = "model.onnx"
        private const val CONFIG_FILENAME = "model.onnx.json"
        private const val WORDS_FILENAME = "words.json"
        const val SAMPLE_RATE = 22050

        @Volatile
        private var INSTANCE: PiperEnglishEngine? = null

        fun getInstance(context: Context): PiperEnglishEngine {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: PiperEnglishEngine(context.applicationContext).also { INSTANCE = it }
            }
        }
    }

    private var ortEnv: OrtEnvironment? = null
    private var ortSession: OrtSession? = null
    private val phonemeIdMap = HashMap<String, Long>()
    private val wordTokenMap = HashMap<String, List<Long>>()
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

    @Synchronized
    fun initialize(): Boolean {
        if (isInitialized.get()) {
            return true
        }

        try {
            val startTime = System.currentTimeMillis()
            Log.d(TAG, "Initializing Piper English Engine (Jenny Dioco)...")

            // 1. Copy model file to app-private files directory for memory mapping
            val targetDir = File(context.filesDir, ASSET_DIR)
            if (!targetDir.exists()) {
                targetDir.mkdirs()
            }

            val modelFile = File(targetDir, MODEL_FILENAME)
            copyAssetIfNeeded("$ASSET_DIR/$MODEL_FILENAME", modelFile)

            // 2. Load model config JSON
            val configContent = context.assets.open("$ASSET_DIR/$CONFIG_FILENAME")
                .bufferedReader(StandardCharsets.UTF_8).use { it.readText() }
            parseConfig(configContent)

            // 3. Load pre-computed vocabulary word tokens
            try {
                val wordsContent = context.assets.open("$ASSET_DIR/$WORDS_FILENAME")
                    .bufferedReader(StandardCharsets.UTF_8).use { it.readText() }
                parseWordMap(wordsContent)
            } catch (e: Exception) {
                Log.w(TAG, "Words dictionary load warning: ${e.message}")
            }

            // 4. Initialize ONNX Runtime
            val env = OrtEnvironment.getEnvironment("PiperEnglish")
            ortEnv = env

            val sessionOptions = OrtSession.SessionOptions().apply {
                setIntraOpNumThreads(2)
                setOptimizationLevel(OrtSession.SessionOptions.OptLevel.BASIC_OPT)
            }

            ortSession = env.createSession(modelFile.absolutePath, sessionOptions)
            isInitialized.set(true)

            val elapsed = System.currentTimeMillis() - startTime
            Log.i(TAG, "ONNX_INIT: SUCCESS. Piper English Engine initialized in ${elapsed}ms. Model: ${modelFile.absolutePath}")
            return true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize Piper English Engine: ${e.message}", e)
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
        Log.d(TAG, "Loaded ${phonemeIdMap.size} phoneme token mappings from Jenny Dioco config")
    }

    private fun parseWordMap(jsonStr: String) {
        val root = JSONObject(jsonStr)
        wordTokenMap.clear()
        val keys = root.keys()
        while (keys.hasNext()) {
            val word = keys.next()
            val arr = root.getJSONArray(word)
            val list = ArrayList<Long>(arr.length())
            for (i in 0 until arr.length()) {
                list.add(arr.getLong(i))
            }
            wordTokenMap[word.lowercase()] = list
        }
        Log.d(TAG, "Loaded ${wordTokenMap.size} vocabulary words for Jenny Dioco phonemization")
    }

    private fun copyAssetIfNeeded(assetPath: String, targetFile: File) {
        if (targetFile.exists() && ModelVerifier.verifyChecksum(targetFile, ModelVerifier.SHA256_ENGLISH)) {
            Log.d(TAG, "MODEL_VERIFY: SUCCESS. Existing English model verified with SHA-256: ${targetFile.absolutePath}")
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

        // Verify complete 64-character SHA-256 checksum on extracted file
        if (!ModelVerifier.verifyChecksum(tempFile, ModelVerifier.SHA256_ENGLISH)) {
            tempFile.delete()
            throw IllegalStateException(
                "English Piper model SHA-256 checksum mismatch! Expected: ${ModelVerifier.SHA256_ENGLISH}"
            )
        }

        if (targetFile.exists()) {
            targetFile.delete()
        }
        val moved = tempFile.renameTo(targetFile)
        if (!moved) {
            throw IllegalStateException("Failed to atomically move temporary model to ${targetFile.absolutePath}")
        }
        Log.i(TAG, "MODEL_VERIFY: SUCCESS. English model extracted and SHA-256 verified (${targetFile.length() / (1024 * 1024)} MB)")
    }

    fun isReady(): Boolean = isInitialized.get()

    /**
     * Checks if all words in the input text exist in our phonemizer vocabulary.
     */
    fun canSynthesize(text: String): Boolean {
        val cleanWords = text.lowercase()
            .replace(Regex("[.,!?:;\"'()\n\r]"), " ")
            .split(Regex("\\s+"))
            .filter { it.isNotBlank() }

        if (cleanWords.isEmpty()) return false
        return cleanWords.all { wordTokenMap.containsKey(it) }
    }

    /**
     * Converts English text to token IDs using word vocabulary.
     */
    fun textToTokenIds(text: String): LongArray {
        val ids = ArrayList<Long>()
        val bos = phonemeIdMap["^"] ?: 1L
        val eos = phonemeIdMap["$"] ?: 2L
        val pad = phonemeIdMap["_"] ?: 0L
        val space = phonemeIdMap[" "] ?: 3L

        ids.add(bos)

        val words = text.lowercase()
            .replace(Regex("[.,!?:;\"'()\n\r]"), " ")
            .split(Regex("\\s+"))
            .filter { it.isNotBlank() }

        for ((index, word) in words.withIndex()) {
            val tokens = wordTokenMap[word]
            if (tokens != null) {
                for (token in tokens) {
                    ids.add(token)
                    ids.add(pad)
                }
            } else {
                // Character fallback if word is unknown
                for (ch in word) {
                    val token = phonemeIdMap[ch.toString()]
                    if (token != null) {
                        ids.add(token)
                        ids.add(pad)
                    }
                }
            }

            if (index < words.size - 1) {
                ids.add(space)
                ids.add(pad)
            }
        }

        ids.add(eos)
        return ids.toLongArray()
    }

    fun speak(text: String, utteranceId: String, callback: Callback?) {
        executor.execute {
            if (!isInitialized.get()) {
                val ok = initialize()
                if (!ok) {
                    callback?.onError(utteranceId, "ONNX_INIT", "INIT_FAILED", "Piper English engine initialization failed")
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
                Log.d(TAG, "INFERENCE: SUCCESS. Completed in ${elapsedInference}ms for utterance: $utteranceId")

                inputTensor.close()
                inputLengthsTensor.close()
                scalesTensor.close()

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

                // Audio optimization tailored for British female articulation
                val optimizedAudio = optimizeSpeechAudio(audioFloats, SAMPLE_RATE)

                if (isStopping.get()) {
                    isSpeaking.set(false)
                    callback?.onDone(utteranceId)
                    return@execute
                }

                val pcm16 = ShortArray(optimizedAudio.size)
                for (i in optimizedAudio.indices) {
                    val s = (optimizedAudio[i] * 32767f).toInt().coerceIn(-32768, 32767)
                    pcm16[i] = s.toShort()
                }

                Log.d(TAG, "PCM_BYTES: ${pcm16.size * 2} (${pcm16.size} samples @ $SAMPLE_RATE Hz)")

                // Play PCM audio via shared AudioTrackPlayer (STREAM_MUSIC / USAGE_MEDIA)
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
                Log.e(TAG, "Jenny Dioco synthesis or playback failed: ${e.message}", e)
                isSpeaking.set(false)
                callback?.onError(utteranceId, "SYNTHESIS", "SYNTHESIS_ERROR", e.message ?: "Synthesis failed")
            }
        }
    }

    /**
     * Biquad DSP filter chain tuned for Jenny Dioco's articulation
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

        // 2. Presence Peaking Filter (3,500 Hz, Gain = +2.0 dB, Q = 1.0) for consonant crispness
        val w0Pr = 2.0 * PI * 3500.0 / sr
        val alphaPr = sin(w0Pr) / (2.0 * 1.0)
        val cosW0Pr = cos(w0Pr)
        val aPrVal = 10.0.pow(2.0 / 40.0)
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

        // 3. Peak normalization to -1.0 dBFS (0.891)
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
