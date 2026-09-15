package com.visionlinkmobile

import android.media.AudioAttributes
import android.os.Build
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.Locale

class TTSModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), TextToSpeech.OnInitListener {

  companion object {
    private const val TAG = "TTSModule"
  }

  private var tts: TextToSpeech? = null
  private var isSystemTtsInitialized = false
  private val piperHausaEngine: PiperHausaEngine by lazy {
    PiperHausaEngine.getInstance(reactContext)
  }
  private val piperEnglishEngine: PiperEnglishEngine by lazy {
    PiperEnglishEngine.getInstance(reactContext)
  }

  init {
    tts = TextToSpeech(reactContext, this)
    // Pre-initialize Piper engines in background thread
    Thread {
      try {
        val okHausa = piperHausaEngine.initialize()
        val okEnglish = piperEnglishEngine.initialize()
        Log.d(TAG, "Piper engines background init: Hausa=$okHausa, English=$okEnglish")
      } catch (e: Exception) {
        Log.e(TAG, "Piper engines background init failed: ${e.message}", e)
      }
    }.start()
  }

  override fun getName(): String = "TTSModule"

  override fun onInit(status: Int) {
    if (status == TextToSpeech.SUCCESS) {
      isSystemTtsInitialized = true

      try {
        val usage = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          AudioAttributes.USAGE_ASSISTANT
        } else {
          AudioAttributes.USAGE_MEDIA
        }
        val audioAttributes = AudioAttributes.Builder()
            .setUsage(usage)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
            .build()
        tts?.setAudioAttributes(audioAttributes)
      } catch (e: Exception) {
        Log.w(TAG, "Failed to set AudioAttributes: ${e.message}")
      }

      tts?.language = Locale.UK
      tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
        override fun onStart(utteranceId: String?) {
          Log.d(TAG, "System TTS speech started: $utteranceId")
          sendEvent("onTTSStart", utteranceId)
        }

        override fun onDone(utteranceId: String?) {
          Log.d(TAG, "System TTS speech completed: $utteranceId")
          sendEvent("onTTSDone", utteranceId)
        }

        @Deprecated("Deprecated in Java")
        override fun onError(utteranceId: String?) {
          Log.e(TAG, "System TTS speech error on utterance: $utteranceId")
          sendEvent("onTTSError", utteranceId)
        }

        override fun onError(utteranceId: String?, errorCode: Int) {
          Log.e(TAG, "System TTS speech error code $errorCode on utterance: $utteranceId")
          sendEvent("onTTSError", utteranceId)
        }
      })
      Log.d(TAG, "System TextToSpeech engine initialized successfully.")
    } else {
      Log.e(TAG, "System TextToSpeech initialization failed with status: $status")
    }
  }

  @ReactMethod
  fun speak(text: String, rate: Float, pitch: Float, language: String, promise: Promise) {
    val utteranceId = "utt_" + System.currentTimeMillis()
    val isHausa = language.equals("ha-NG", ignoreCase = true) || language.equals("ha", ignoreCase = true)
    val isEnglish = language.equals("en-GB", ignoreCase = true) || language.equals("en-US", ignoreCase = true) || language.equals("en", ignoreCase = true)
    val isArabic = language.equals("ar", ignoreCase = true) || language.startsWith("ar-", ignoreCase = true)
    val isHindi = language.equals("hi-IN", ignoreCase = true) || language.equals("hi", ignoreCase = true)

    if (isHausa) {
      // Route Hausa to offline on-device Piper neural TTS engine (Female Persona F4 / Malama Asabe)
      Log.d(TAG, "Routing Hausa utterance to PiperHausaEngine: '$text' [utt=$utteranceId]")
      piperHausaEngine.speak(text, utteranceId, object : PiperHausaEngine.Callback {
        override fun onStart(id: String) { sendEvent("onTTSStart", id) }
        override fun onDone(id: String) { sendEvent("onTTSDone", id) }
        override fun onError(id: String, error: String) {
          Log.e(TAG, "Piper Hausa error: $error on utterance: $id")
          sendEvent("onTTSError", id)
        }
      })
      promise.resolve(utteranceId)
      return
    }

    if (isEnglish) {
      // If Piper English Jenny Dioco can synthesize, use offline neural VITS
      if (piperEnglishEngine.isReady() && piperEnglishEngine.canSynthesize(text)) {
        Log.d(TAG, "Routing English utterance to PiperEnglishEngine (Jenny Dioco): '$text' [utt=$utteranceId]")
        piperEnglishEngine.speak(text, utteranceId, object : PiperEnglishEngine.Callback {
          override fun onStart(id: String) { sendEvent("onTTSStart", id) }
          override fun onDone(id: String) { sendEvent("onTTSDone", id) }
          override fun onError(id: String, error: String) {
            Log.w(TAG, "Piper English error: $error on utterance: $id. Falling back to System TTS.")
            speakWithSystemTts(text, rate, pitch, Locale.UK, utteranceId, promise)
          }
        })
        promise.resolve(utteranceId)
        return
      } else {
        // Fallback for unmapped English words to system UK English
        Log.d(TAG, "Executing system UK TTS for English text: '$text'")
        speakWithSystemTts(text, rate, pitch, Locale.UK, utteranceId, promise)
        return
      }
    }

    if (isArabic) {
      // Route Arabic to Android System TTS with Arabic locale
      Log.d(TAG, "Executing system Arabic TTS for: '$text'")
      val arLocale = Locale.forLanguageTag("ar")
      speakWithSystemTts(text, rate, pitch, arLocale, utteranceId, promise)
      return
    }

    if (isHindi) {
      // Route Hindi to Android System TTS with Hindi locale
      Log.d(TAG, "Executing system Hindi TTS for: '$text'")
      val hiLocale = Locale.forLanguageTag("hi-IN")
      speakWithSystemTts(text, rate, pitch, hiLocale, utteranceId, promise)
      return
    }

    // Default / fallback
    speakWithSystemTts(text, rate, pitch, Locale.UK, utteranceId, promise)
  }

  private fun speakWithSystemTts(text: String, rate: Float, pitch: Float, locale: Locale, utteranceId: String, promise: Promise) {
    if (!isSystemTtsInitialized || tts == null) {
      promise.reject("TTS_NOT_READY", "System TextToSpeech engine is not initialized yet.")
      return
    }

    try {
      tts?.setLanguage(locale)
      tts?.setSpeechRate(rate)
      tts?.setPitch(pitch)

      val result = tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, utteranceId)
      if (result == TextToSpeech.SUCCESS) {
        promise.resolve(utteranceId)
      } else {
        promise.reject("TTS_SPEAK_ERROR", "Failed to execute system tts.speak(), code: $result")
      }
    } catch (e: Exception) {
      promise.reject("TTS_EXCEPTION", e.message, e)
    }
  }

  @ReactMethod
  fun stop(promise: Promise) {
    try {
      piperHausaEngine.stop()
      piperEnglishEngine.stop()
      tts?.stop()
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("TTS_STOP_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun isLanguageSupported(language: String, promise: Promise) {
    val isHausa = language.equals("ha-NG", ignoreCase = true) || language.equals("ha", ignoreCase = true)
    val isEnglish = language.equals("en-GB", ignoreCase = true) || language.equals("en-US", ignoreCase = true) || language.equals("en", ignoreCase = true)
    if (isHausa || isEnglish) {
      // Both Piper Hausa and Piper English are embedded in the APK assets
      promise.resolve(true)
      return
    }

    if (!isSystemTtsInitialized || tts == null) {
      promise.resolve(false)
      return
    }

    val locale = when {
      language.startsWith("ar", ignoreCase = true) -> Locale.forLanguageTag("ar")
      language.startsWith("hi", ignoreCase = true) -> Locale.forLanguageTag("hi-IN")
      else -> Locale.UK
    }

    val result = tts?.isLanguageAvailable(locale)
    val isSupported = result != null &&
        result != TextToSpeech.LANG_MISSING_DATA &&
        result != TextToSpeech.LANG_NOT_SUPPORTED
    promise.resolve(isSupported)
  }

  @ReactMethod
  fun getEngineInfo(promise: Promise) {
    val map = Arguments.createMap()
    map.putString("piperHausaStatus", if (piperHausaEngine.isReady()) "ready" else "initializing")
    map.putString("piperEnglishStatus", if (piperEnglishEngine.isReady()) "ready" else "initializing")
    map.putString("activeHausaSpeaker", if (piperHausaEngine.activeSpeakerId == 3L) "F4_Malama_Asabe" else "F2")
    map.putString("englishVoice", "Jenny_Dioco_en_GB")
    map.putInt("sampleRate", PiperHausaEngine.SAMPLE_RATE)
    map.putBoolean("isSpeaking", piperHausaEngine.isSpeakingNow() || piperEnglishEngine.isSpeakingNow())
    promise.resolve(map)
  }

  private fun sendEvent(eventName: String, params: String?) {
    try {
      val map: WritableMap = Arguments.createMap()
      map.putString("utteranceId", params ?: "")
      reactContext
          .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          .emit(eventName, map)
    } catch (e: Exception) {
      Log.e(TAG, "Failed to send event $eventName", e)
    }
  }
}
