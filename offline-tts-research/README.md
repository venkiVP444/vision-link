# Vision-Link: Offline Hausa Text-to-Speech (TTS) Voice Research & Implementation

This document details the voice candidate evaluation, selection rationale, runtime audio optimization specifications, and on-device benchmark results on physical hardware (**POCO C75 5G**, Android 16 / SDK 36, arm64-v8a) for the **Vision-Link** assistive mobile application.

---

## 1. Candidate Comparison Table

| Candidate | Female | Hausa | Naturalness | Model Size | Offline | Android Feasible | License Status | Source |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Candidate 01: Murya Piper Hausa (F4 / Malama Asabe & F2)** | Yes | Yes (Kano) | **High** (22.05 kHz neural VITS) | **73.5 MB** (ONNX) | **100% Offline** | **Very High** (ONNX Runtime Android) | **CC-BY-NC-SA 4.0** *(Non-commercial; see Section 7)* | [adab-tech/murya-piper-hausa-tts](https://huggingface.co/adab-tech/murya-piper-hausa-tts) |
| **Candidate 02: Meta MMS-TTS Hausa (VITS)** | Yes (~216 Hz) | Yes (General) | **Moderate** (16 kHz, formal cadence) | **138.5 MB** (PyTorch / ~70 MB ONNX) | **100% Offline** | **Moderate-High** (Requires ONNX export) | CC-BY-NC 4.0 | [facebook/mms-tts-hau](https://huggingface.co/facebook/mms-tts-hau) |
| **Candidate 03: Android Native Google Speech Services (`ha-NG`)** | Yes | Yes | **Moderate-Low** (Robotic/monotone) | **0 MB added** (~25 MB OS pack) | **Conditional** (Requires manual OS voice pack download) | **Native** (Immediate OS API) | Google Proprietary (Free OS) | Built-in Android / Google Play Services |
| **Candidate 04: CLEAR Global / TWB-Voice Hausa (YourTTS)** | Yes (`spk_f_1`) | Yes (Kano) | **High** (24 kHz YourTTS) | **1,066 MB** (~1.06 GB PyTorch) | **Offline** (Desktop/Server) | **Very Low** (Prohibitive 1 GB size) | CC-BY-NC 4.0 | [CLEAR-Global/TWB-Voice-Hausa-TTS-1.0](https://huggingface.co/CLEAR-Global/TWB-Voice-Hausa-TTS-1.0) |
| **Candidate 05: Coqui XTTS-v2 Hausa Female (WaxalNLP)** | Yes | Yes | **Very High** (Studio expressiveness) | **5,387 MB** (~5.4 GB checkpoint) | **Offline** (Server/GPU only) | **Unfeasible** (5.4 GB, >5s CPU latency) | CPML (Non-commercial) | [vaghawan/xtts-v2-stage-b-female-waxalnlp](https://huggingface.co/vaghawan/xtts-v2-stage-b-female-waxalnlp-3-5epoch-1h-hausa-speaker-female-waxalnlp-3) |

---

## 2. Final Selected Voice & Selection Rationale

### Selected Voice: **Murya Piper Hausa — Persona F4 (Malama Asabe)**
* **Persona ID**: Speaker ID `3` (F4 / Malama Asabe)
* **Secondary / Crisp Alternative**: Speaker ID `0` (F2)

### Selection Rationale:
1. **Empathetic, Soothing Tone for Visually Impaired Users**:
   Visually impaired individuals depend on audio for spatial navigation. Abrupt, harsh, or robotic voices induce auditory fatigue and anxiety during unexpected obstacle warnings. Persona **F4 (Malama Asabe)** has a fundamental pitch of ~279 Hz with a calm, conversational cadence that delivers authoritative navigational directions without startling the user.
2. **Authentic Kano Hausa Articulation**:
   Trained on Google's WAXAL corpus and fine-tuned for Standard Kano Hausa (Eastern/Kenanci). Native handling of Hausa hooked consonants (`ƙ`, `ƴ`, `ɓ`, `ɗ`) and glottalized vowels.
3. **High-Fidelity 22.05 kHz Acoustic Output**:
   Unlike Meta MMS (16 kHz telephony-grade), Murya Piper generates rich 22.05 kHz audio that cuts through ambient outdoor noise.
4. **Self-Contained On-Device Footprint**:
   The model is only **73.5 MB**, packaged directly as an ONNX graph requiring no external PyTorch or Python dependencies.

---

## 3. Architecture & Runtime Audio Processing

> [!IMPORTANT]
> **Runtime Processing vs. Static WAV Files**:
> Pre-generated WAV files are **strictly for testing, listening, and voice evaluation**. The production mobile app does **NOT** play static WAVs.
> The production pipeline executes in real time:
> $$\text{Text} \xrightarrow{\text{Tokenization}} \text{model.onnx} \xrightarrow{\text{ONNX Runtime}} \text{Raw PCM (22.05 kHz)} \xrightarrow{\text{Biquad Audio DSP}} \text{Android AudioTrack}$$

```mermaid
graph LR
    A[Camera / Sensor] --> B[Object Detection API]
    B --> C[Hazard Warning]
    C --> D[Hausa Translation]
    D --> E[PiperHausaEngine]
    E --> F[Character Tokenizer]
    F --> G[ONNX Runtime Session]
    G --> H[Raw PCM Float Buffer]
    H --> I[Runtime Biquad DSP Filter]
    I --> J[AudioTrack 22050Hz Playback]
```

### Runtime DSP Filter Chain (`PiperHausaEngine.kt`)
To ensure crystal-clear speech through low-end mobile phone speakers and bone-conduction headsets in noisy outdoor environments (markets, traffic), each synthesized audio buffer passes through real-time biquad filtering before reaching the `AudioTrack`:

1. **High-Pass Filter (Low-End Rumble Removal)**:
   * **Cutoff**: 85 Hz
   * **Q**: 0.707 (Butterworth)
   * **Purpose**: Removes sub-audible low-frequency rumble and DC offset that causes phone speaker distortion.
2. **Parametric Boxiness Cut (Formant De-muddling)**:
   * **Center Frequency**: 320 Hz
   * **Gain**: -2.5 dB
   * **Q**: 1.2
   * **Purpose**: Attenuates chesty resonance, making phonemes cleaner.
3. **High-Shelf Presence Boost (Intelligibility Enhancement)**:
   * **Frequency**: 3,200 Hz
   * **Gain**: +3.5 dB
   * **Q**: 1.0
   * **Purpose**: Enhances consonant definition (`k`, `t`, `s`, hooked `ƙ`, `ɓ`, `ɗ`), making warnings easily decipherable against street noise.
4. **Peak Limiter & Normalization**:
   * **Ceiling**: -1.0 dBFS (0.891 amplitude)
   * **Gain**: Automatic dynamic makeup gain (+6.8 dB to +8.1 dB)
   * **Purpose**: Maximizes acoustic output loudness without digital clipping or speaker crackle.

---

## 4. Measured Device Benchmarks (POCO C75 5G)

All metrics were measured on physical hardware:
* **Device**: POCO C75 5G (`bd32ffa6`, model `24116PCC1I`)
* **OS / Chipset**: Android 16 (SDK 36), 64-bit ARM (`arm64-v8a`)
* **Runtime**: `com.microsoft.onnxruntime:onnxruntime-android:1.20.0` (2 CPU threads)

> [!NOTE]
> Targets were **not assumed beforehand**; all values below represent actual wall-clock timings measured across multiple iterations on device.

### Benchmark Results (Persona F4 / Malama Asabe — SID 3)

| Warning Sentence (Hausa) | English Translation | Chars | Inference Latency | Time-to-First-Audio (TTFA) | Audio Duration | Runtime Heap RAM |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| *"Akwai mutum a gabanka, ka kula."* | Person ahead. Please be careful. | 32 | **449 ms** | **482 ms** | 2,538 ms | 7.2 MB |
| *"Akwai mota a gabanka, ka kula."* | Vehicle ahead. Please be careful. | 31 | **464 ms** | **498 ms** | 2,595 ms | 7.6 MB |
| *"Akwai cikas a gabanka, ka kula."* | Obstacle ahead. Please be careful. | 33 | **380 ms** | **413 ms** | 2,131 ms | 8.1 MB |
| *"Hanya a buɗe take, babu wani cikas."* | Path is clear. No obstacle warnings. | 37 | **474 ms** | **512 ms** | 2,687 ms | 9.0 MB |
| **F4 Persona Averages** | — | — | **441.7 ms** | **476.2 ms** | **2,488 ms** | **7.98 MB** |

### Benchmark Results (Persona F2 — Crisp Alternative — SID 0)

| Warning Sentence (Hausa) | English Translation | Chars | Inference Latency | Time-to-First-Audio (TTFA) | Audio Duration | Runtime Heap RAM |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| *"Akwai mutum a gabanka, ka kula."* | Person ahead. Please be careful. | 32 | **398 ms** | **444 ms** | 2,552 ms | 10.1 MB |
| *"Akwai mota a gabanka, ka kula."* | Vehicle ahead. Please be careful. | 31 | **374 ms** | **410 ms** | 2,188 ms | 11.2 MB |
| *"Akwai cikas a gabanka, ka kula."* | Obstacle ahead. Please be careful. | 33 | **356 ms** | **396 ms** | 2,202 ms | 11.4 MB |
| *"Hanya a buɗe take, babu wani cikas."* | Path is clear. No obstacle warnings. | 37 | **449 ms** | **486 ms** | 2,748 ms | 12.0 MB |
| **F2 Persona Averages** | — | — | **394.2 ms** | **434.0 ms** | **2,422 ms** | **11.18 MB** |

### Cold Initialization & Memory Footprint
* **Asset Copy & Session Creation**: 4,073 ms on first application launch (performed asynchronously in background thread; zero UI freeze).
* **Warm In-Memory Execution**: The ONNX session remains active in memory. Subsequent utterances do not pay initialization cost.
* **Heap Allocation Overhead**: ~7.8 MB for F4, well within mobile memory constraints.

---

## 5. Offline & Airplane Mode Verification

1. **Airplane Mode Test**:
   * Verified by enabling Airplane Mode via Android OS command:
     `cmd connectivity airplane-mode enable`
   * Executed test utterance: *"Hanya a buɗe take, babu wani cikas."*
   * Result: Synthesis completed in **628 ms**, 100% on-device with zero network traffic.
2. **No Silent Fallback for Hausa**:
   * If `PiperHausaEngine` encounters an unrecoverable failure (e.g., model file corruption, memory exhaust), it logs an explicit diagnostic error:
     `TTSModule: Piper Hausa TTS error: <message> - Not falling back to Android TTS to prevent wrong voice playback`
   * It does **not** switch to system Android TTS, ensuring the team's approved female voice requirement is never silently substituted with an incorrect robot voice.
3. **Multi-Language Routing**:
   * `ha-NG` / `ha`: Routed to on-device `PiperHausaEngine`.
   * `en-US` / `en`: Routed to system `android.speech.tts.TextToSpeech`.

---

## 6. APK Size Impact Breakdown

* **Pre-integration Debug APK**: `143.44 MB`
* **Post-integration Debug APK**: `284.50 MB` (Universal multi-ABI APK containing `arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64` native binaries)
* **Model Assets Added**:
  * `model.onnx`: `73.49 MB` (packaged with `noCompress 'onnx'`)
  * `model.onnx.json`: `4.05 KB`
* **Library Added**:
  * `com.microsoft.onnxruntime:onnxruntime-android:1.20.0` (includes native runtime for all 4 architectures).
* **Production Recommendation**: When building release bundles (`.aab` via Google Play App Bundle), the per-architecture download size for target ARM64 devices is **~85 MB total**.

---

## 7. Licensing & Release Considerations

> [!CAUTION]
> **CC-BY-NC-SA 4.0 Non-Commercial Restriction**:
> The `murya-piper-hausa-tts` model checkpoint is released under **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC-BY-NC-SA 4.0)**.
> * **Permitted**: Internal evaluation, academic research, non-commercial assistive pilots, humanitarian open-source deployments.
> * **Commercial Restriction**: If Vision-Link is distributed commercially or monetized, a commercial clearance license must be secured from the author ([murya.ng](https://murya.ng) / Adab Technologies).
> * **Release Action**: This voice is **NOT** commercially cleared. Keep this licensing requirement documented for product management and legal clearance before public store distribution.

---

## 8. Summary of Evaluation Audio Assets

Audio samples for listening and verification are saved in `offline-tts-research/voice-samples/`:

* `candidate-01-piper-f4-optimized.wav`: Primary recommended female voice (F4 / Malama Asabe) with runtime DSP settings applied (+6.8 dB gain, 85Hz HP, 3.2kHz boost).
* `candidate-01-piper-f2-optimized.wav`: Crisp alternative female voice (F2) with runtime DSP settings applied (+8.1 dB gain).
* `candidate-01-piper-female-hausa.wav`: Original un-optimized F4 sample.
* `candidate-01-piper-female-hausa-f2.wav`: Original un-optimized F2 sample.
* `candidate-02-vits-female-hausa.wav`: Meta MMS-TTS Hausa evaluation sample.
