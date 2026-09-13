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

  private var tts: TextToSpeech? = null
  private var isInitialized = false

  init {
    tts = TextToSpeech(reactContext, this)
  }

  override fun getName(): String = "TTSModule"

  override fun onInit(status: Int) {
    if (status == TextToSpeech.SUCCESS) {
      isInitialized = true
      
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
        Log.w("TTSModule", "Failed to set AudioAttributes: ${e.message}")
      }

      tts?.language = Locale.US
      tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
        override fun onStart(utteranceId: String?) {
          Log.d("TTSModule", "Speech started: $utteranceId")
          sendEvent("onTTSStart", utteranceId)
        }

        override fun onDone(utteranceId: String?) {
          Log.d("TTSModule", "Speech completed: $utteranceId")
          sendEvent("onTTSDone", utteranceId)
        }

        @Deprecated("Deprecated in Java")
        override fun onError(utteranceId: String?) {
          Log.e("TTSModule", "Speech error on utterance: $utteranceId")
          sendEvent("onTTSError", utteranceId)
        }

        override fun onError(utteranceId: String?, errorCode: Int) {
          Log.e("TTSModule", "Speech error code $errorCode on utterance: $utteranceId")
          sendEvent("onTTSError", utteranceId)
        }
      })
      Log.d("TTSModule", "TextToSpeech engine initialized successfully.")
    } else {
      Log.e("TTSModule", "TextToSpeech initialization failed with status: $status")
    }
  }

  @ReactMethod
  fun speak(text: String, rate: Float, pitch: Float, language: String, promise: Promise) {
    if (!isInitialized || tts == null) {
      promise.reject("TTS_NOT_READY", "TextToSpeech engine is not initialized yet.")
      return
    }

    try {
      var locale = if (language.equals("ha-NG", ignoreCase = true) || language.equals("ha", ignoreCase = true)) {
        Locale("ha", "NG")
      } else {
        Locale.US
      }

      var langResult = tts?.setLanguage(locale)
      if (langResult == TextToSpeech.LANG_MISSING_DATA || langResult == TextToSpeech.LANG_NOT_SUPPORTED) {
        Log.w("TTSModule", "Language $language voice data missing on Android TTS engine. Re-setting engine to US English.")
        locale = Locale.US
        langResult = tts?.setLanguage(locale)
      }

      tts?.setSpeechRate(rate)
      tts?.setPitch(pitch)

      val utteranceId = "utt_" + System.currentTimeMillis()
      Log.d("TTSModule", "Executing tts.speak for: '$text' [lang=$language, activeLocale=$locale]")
      
      val result = tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, utteranceId)

      if (result == TextToSpeech.SUCCESS) {
        promise.resolve(utteranceId)
      } else {
        promise.reject("TTS_SPEAK_ERROR", "Failed to execute tts.speak(), code: $result")
      }
    } catch (e: Exception) {
      promise.reject("TTS_EXCEPTION", e.message, e)
    }
  }

  @ReactMethod
  fun stop(promise: Promise) {
    try {
      tts?.stop()
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("TTS_STOP_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun isLanguageSupported(language: String, promise: Promise) {
    if (!isInitialized || tts == null) {
      promise.resolve(false)
      return
    }
    val locale = if (language.equals("ha-NG", ignoreCase = true)) Locale("ha", "NG") else Locale.US
    val result = tts?.isLanguageAvailable(locale)
    val isSupported = result != null &&
        result != TextToSpeech.LANG_MISSING_DATA &&
        result != TextToSpeech.LANG_NOT_SUPPORTED
    promise.resolve(isSupported)
  }

  private fun sendEvent(eventName: String, params: String?) {
    try {
      val map: WritableMap = Arguments.createMap()
      map.putString("utteranceId", params ?: "")
      reactContext
          .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          .emit(eventName, map)
    } catch (e: Exception) {
      Log.e("TTSModule", "Failed to send event $eventName", e)
    }
  }
}
