# Vision-Link: Offline Hausa Piper TTS Integration Guide

This guide explains the technical integration of the offline Piper female Hausa TTS engine into the Vision-Link Android app, including runtime architecture, audio DSP filters, Native/TypeScript interfaces, and troubleshooting.

---

## 1. System Architecture

```
+-------------------------------------------------------------+
|                      React Native UI Layer                  |
|                 (src/features/tts/ttsService.ts)            |
+-------------------------------------------------------------+
                              |
                     Native Modules Call
                              |
                              v
+-------------------------------------------------------------+
|                Android Native Module (TTSModule.kt)         |
|   - Language Router:                                        |
|       * "ha-NG" / "ha" --> PiperHausaEngine                 |
|       * "en-US" / "en" --> Android TextToSpeech             |
|   - No Silent Fallback for Hausa (logs error directly)      |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
|               PiperHausaEngine (Kotlin Native)              |
|                                                             |
|   1. Character Tokenizer:                                   |
|      - Parses standard ASCII + Hausa hooked letters:        |
|        'ƙ', 'ƴ', 'ɓ', 'ɗ'                                   |
|      - Inserts BOS / EOS tokens                             |
|                                                             |
|   2. ONNX Runtime Inference (v1.20.0):                      |
|      - Input:  int64 phoneme sequence                       |
|      - Config: length_scale=1.0, noise_scale=0.667          |
|      - Speaker ID: 3 (F4 / Malama Asabe) or 0 (F2)          |
|      - Output: Float32 PCM @ 22,050 Hz                      |
|                                                             |
|   3. Real-Time Audio DSP Processing (Biquad Filters):       |
|      - High-Pass Filter @ 85 Hz (Q=0.707)                   |
|      - Parametric Peak Notch @ 320 Hz (-2.5 dB, Q=1.2)      |
|      - High-Shelf Presence @ 3200 Hz (+3.5 dB, Q=1.0)       |
|      - Peak Normalization / Soft Limiter (-1.0 dBFS)        |
|                                                             |
|   4. Audio Output (AudioTrack):                             |
|      - 22,050 Hz, 16-bit Mono, USAGE_ASSISTANT              |
|      - Coordinates with device volume and focus             |
+-------------------------------------------------------------+
```

---

## 2. Key Files & Modifications

### Native Android Layer
1. **`android/app/build.gradle`**:
   - Added dependency: `implementation("com.microsoft.onnxruntime:onnxruntime-android:1.20.0")`.
   - Added `aaptOptions { noCompress 'onnx' }` to prevent APK compression from corrupting ONNX tensor alignment.
2. **`android/app/src/main/assets/offline_tts/hausa/`**:
   - `model.onnx` (73.49 MB): Quantized/optimized Piper neural VITS model.
   - `model.onnx.json` (4.05 KB): Configuration containing `phoneme_id_map`, sample rate (22,050 Hz), and speaker persona map.
3. **`android/app/src/main/java/com/visionlinkmobile/PiperHausaEngine.kt`**:
   - Manages ONNX session initialization asynchronously without blocking application startup.
   - Converts Hausa characters directly to token IDs based on `model.onnx.json`.
   - Runs inference on 2 dedicated worker threads.
   - Applies real-time digital signal processing (DSP) biquad filters directly to synthesized PCM buffers.
   - Plays audio via `android.media.AudioTrack`.
4. **`android/app/src/main/java/com/visionlinkmobile/TTSModule.kt`**:
   - Implements `speak(text, language, options, promise)` with routing.
   - For Hausa (`ha-NG`/`ha`), passes directly to `PiperHausaEngine`.
   - If `PiperHausaEngine` fails, emits an explicit diagnostic error event (`TTSModule: Piper Hausa TTS error: <error> - Not falling back to Android TTS to prevent wrong voice playback`).
   - For English (`en-US`/`en`), routes to system `android.speech.tts.TextToSpeech`.
5. **`android/app/src/main/java/com/visionlinkmobile/MainActivity.kt`**:
   - Registered `TTS_TEST` broadcast receiver for automated testing and device telemetry verification.

### React Native Layer
1. **`src/features/tts/ttsService.ts`**:
   - Detects Hausa language selections and triggers `TTSModule.speak(text, 'ha-NG')`.
   - Preserves obstacle warning suppression (5-second throttle for repeated hazards).
   - In `translateText()`, if text is already in Hausa (e.g. *"Akwai mutum a gabanka, ka kula."*), it passes through directly without unnecessary translation lookups.
   - Added exported utility methods: `stopSpeaking()`, `initializeTTS()`, `isTTSAvailable()`, and `getEngineInfo()`.

---

## 3. Testing & Verification Commands

### Run Unit Tests
```bash
npm test -- __tests__/ttsService.test.ts
```

### TypeScript Validation
```bash
npx tsc --noEmit
```

### Trigger On-Device Audio Test via ADB
```bash
# Speaker ID 3 (F4 / Malama Asabe - Recommended)
adb shell "am broadcast -a com.visionlinkmobile.TTS_TEST --es text 'Akwai mota a gabanka, ka kula.' --el sid 3"

# Speaker ID 0 (F2 - Crisp Alternative)
adb shell "am broadcast -a com.visionlinkmobile.TTS_TEST --es text 'Akwai mota a gabanka, ka kula.' --el sid 0"
```

### Inspect On-Device Latency in Logcat
```bash
adb logcat -d -s PiperHausaEngine:D TTSModule:D
```
Expected output:
```text
D PiperHausaEngine: Inference completed in 449ms for utterance: bench_xxxx (32 chars)
D PiperHausaEngine: Audio processing & playback started (55968 samples, 2538ms duration)
```

---

## 4. Licensing Notice

The Murya Piper Hausa model (`model.onnx`) is licensed under **CC-BY-NC-SA 4.0** (Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International).
* Commercial distribution requires commercial clearance from [murya.ng](https://murya.ng) / Adab Technologies.
* Do not describe the model as commercially cleared until commercial licensing terms are executed.
