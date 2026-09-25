package com.visionlinkmobile

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Bundle
import android.os.Debug
import android.util.Log
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import java.util.Locale

class MainActivity : ReactActivity(), TextToSpeech.OnInitListener {

  companion object {
    private const val TAG = "VisionLinkTTS"
    const val ACTION_TTS_TEST = "com.visionlinkmobile.TTS_TEST"
  }

  private var systemTts: TextToSpeech? = null
  private var isSystemTtsReady = false

  override fun onInit(status: Int) {
    if (status == TextToSpeech.SUCCESS) {
      isSystemTtsReady = true
      Log.i(TAG, "MainActivity system TTS initialized successfully")
    } else {
      Log.e(TAG, "MainActivity system TTS initialization failed: $status")
    }
  }

  private val ttsReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      if (intent?.action == ACTION_TTS_TEST) {
        val lang = intent.getStringExtra("lang") ?: "ha-NG"
        val text = intent.getStringExtra("text") ?: when (lang) {
          "ha-NG" -> "Akwai mutum a gabanka, ka kula."
          "ar" -> "يوجد شخص أمامك. يرجى توخي الحذر."
          "hi-IN" -> "सामने व्यक्ति है। कृपया सावधान रहें।"
          else -> "Person ahead. Please be careful."
        }

        val memoryBefore = (Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory()) / (1024 * 1024)
        val pssBefore = Debug.getPss() / 1024
        Log.i(TAG, "==================================================")
        Log.i(TAG, "[BENCHMARK START] Lang: $lang, Utterance: '$text'")
        Log.i(TAG, "[MEMORY] RAM Before: App Heap = ${memoryBefore}MB, PSS = ${pssBefore}MB")

        val triggerTime = System.currentTimeMillis()
        var firstAudioTime = 0L

        when (lang) {
          "ha-NG" -> {
            val sid = intent.getLongExtra("sid", 3L) // default 3 = F4 (Malama Asabe)
            val piper = PiperHausaEngine.getInstance(applicationContext)
            piper.activeSpeakerId = sid
            Log.i(TAG, "[ENGINE] Piper Hausa F4 (SID: $sid)")

            piper.speak(text, "bench_ha_" + triggerTime, object : PiperHausaEngine.Callback {
              override fun onStart(utteranceId: String) {
                firstAudioTime = System.currentTimeMillis()
                val ttfa = firstAudioTime - triggerTime
                val memoryDuring = (Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory()) / (1024 * 1024)
                Log.i(TAG, "[TTFA] Time To First Audio: ${ttfa}ms")
                Log.i(TAG, "[MEMORY] RAM During Speech: App Heap = ${memoryDuring}MB")
              }

              override fun onDone(utteranceId: String) {
                val totalTime = System.currentTimeMillis() - triggerTime
                val speechDuration = if (firstAudioTime > 0) System.currentTimeMillis() - firstAudioTime else totalTime
                Log.i(TAG, "[SPEECH DONE] Total Duration: ${totalTime}ms (Audio Playing Duration: ${speechDuration}ms)")
                Log.i(TAG, "==================================================")
              }

              override fun onError(utteranceId: String, stage: String, errorCode: String, message: String) {
                Log.e(TAG, "[ERROR] Speech Failed: [$stage] $errorCode - $message")
                Log.i(TAG, "==================================================")
              }
            })
          }
          "en-GB" -> {
            val piperEn = PiperEnglishEngine.getInstance(applicationContext)
            Log.i(TAG, "[ENGINE] Piper English Jenny Dioco")

            piperEn.speak(text, "bench_en_" + triggerTime, object : PiperEnglishEngine.Callback {
              override fun onStart(utteranceId: String) {
                firstAudioTime = System.currentTimeMillis()
                val ttfa = firstAudioTime - triggerTime
                val memoryDuring = (Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory()) / (1024 * 1024)
                Log.i(TAG, "[TTFA] Time To First Audio: ${ttfa}ms")
                Log.i(TAG, "[MEMORY] RAM During Speech: App Heap = ${memoryDuring}MB")
              }

              override fun onDone(utteranceId: String) {
                val totalTime = System.currentTimeMillis() - triggerTime
                val speechDuration = if (firstAudioTime > 0) System.currentTimeMillis() - firstAudioTime else totalTime
                Log.i(TAG, "[SPEECH DONE] Total Duration: ${totalTime}ms (Audio Playing Duration: ${speechDuration}ms)")
                Log.i(TAG, "==================================================")
              }

              override fun onError(utteranceId: String, stage: String, errorCode: String, message: String) {
                Log.e(TAG, "[ERROR] Speech Failed: [$stage] $errorCode - $message")
                Log.i(TAG, "==================================================")
              }
            })
          }
          "ar" -> {
            Log.i(TAG, "[ENGINE] Android System TTS Arabic")
            speakSystemTts(text, Locale.forLanguageTag("ar"), triggerTime)
          }
          "hi-IN" -> {
            Log.i(TAG, "[ENGINE] Android System TTS Hindi")
            speakSystemTts(text, Locale.forLanguageTag("hi-IN"), triggerTime)
          }
          else -> {
            Log.i(TAG, "[ENGINE] Fallback System TTS")
            speakSystemTts(text, Locale.UK, triggerTime)
          }
        }
      }
    }

    private fun speakSystemTts(text: String, locale: Locale, triggerTime: Long) {
      if (systemTts == null) {
        systemTts = TextToSpeech(applicationContext, this@MainActivity)
      }
      var firstAudioTime = 0L
      val uttId = "bench_sys_" + triggerTime

      systemTts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
        override fun onStart(utteranceId: String?) {
          firstAudioTime = System.currentTimeMillis()
          val ttfa = firstAudioTime - triggerTime
          val memoryDuring = (Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory()) / (1024 * 1024)
          Log.i(TAG, "[TTFA] Time To First Audio: ${ttfa}ms")
          Log.i(TAG, "[MEMORY] RAM During Speech: App Heap = ${memoryDuring}MB")
        }

        override fun onDone(utteranceId: String?) {
          val totalTime = System.currentTimeMillis() - triggerTime
          val speechDuration = if (firstAudioTime > 0) System.currentTimeMillis() - firstAudioTime else totalTime
          Log.i(TAG, "[SPEECH DONE] Total Duration: ${totalTime}ms (Audio Playing Duration: ${speechDuration}ms)")
          Log.i(TAG, "==================================================")
        }

        override fun onError(utteranceId: String?) {
          Log.e(TAG, "[ERROR] Speech Failed on utterance $utteranceId")
          Log.i(TAG, "==================================================")
        }
      })

      systemTts?.language = locale
      systemTts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, uttId)
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(null)
    val filter = IntentFilter(ACTION_TTS_TEST)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      registerReceiver(ttsReceiver, filter, Context.RECEIVER_EXPORTED)
    } else {
      registerReceiver(ttsReceiver, filter)
    }
  }

  override fun onDestroy() {
    super.onDestroy()
    try {
      unregisterReceiver(ttsReceiver)
    } catch (e: Exception) {
      // ignore
    }
    try {
      systemTts?.shutdown()
      systemTts = null
    } catch (e: Exception) {
      // ignore
    }
  }

  override fun getMainComponentName(): String = "VisionLinkMobile"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
