# Vision-Link: Multilingual Offline TTS Research Summary

## 1. Final Recommendations

* **English Candidate**: **Amy (`en_US-amy-medium`)**
  - Alternative: Jenny Dioco (`en_GB-jenny_dioco-medium`)
  - Backup: Cori (`en_GB-cori-high`)
* **Arabic Candidate**: **Emirati Female (`vadimbelsky/arabic-emirati-female-piper`)**
  - Alternative: Nabra-82M (`oddadmix/Nabra-82M-v0.1` via `sherpa-onnx`)
  - Backup: Android Native Google Speech Services (`ar`)
* **Hindi Candidate**: **Priyamvada (`hi_IN-priyamvada-medium`)**
  - Alternative: Android Native Google Speech Services (`hi-IN` Female)
  - Backup: Priyamvada Fast Alert Profile (`length_scale=0.85`)

---

## 2. Key Technical Details

* **Shared Architecture**: All primary recommendations (Amy, Emirati Female, Priyamvada) are **Piper VITS ONNX** models running at **22,050 Hz**.
* **Engine Reusability**: All three run directly on our existing `com.microsoft.onnxruntime:onnxruntime-android:1.20.0` C++ engine without introducing new native libraries or C++ binaries.
* **Storage Footprint**:
  - English (Amy): **60.2 MB**
  - Arabic (Emirati Female): **60.5 MB**
  - Hindi (Priyamvada): **60.5 MB**
* **Audio Pipeline**: Raw models generate float PCM, which will plug into our existing 4-stage biquad DSP chain (85 Hz high-pass, 320 Hz notch, 3.2 kHz presence boost, -1.0 dBFS soft limiter) for mobile speaker clarity.
* **Evaluation Samples**: Real WAV audio samples synthesized for all 9 candidates are available in:
  `offline-tts-research/voice-samples/multilingual/`

---

## 3. Licensing Status

| Language | Primary Voice | Model License | Dataset License | Commercial Classification |
| :--- | :--- | :--- | :--- | :--- |
| **English** | **Amy** | CC BY-SA 4.0 | Mimic3 Open Dataset | **Commercial use allowed with conditions** (Requires attribution and share-alike notices). |
| **Arabic** | **Emirati Female** | MIT License | Community Corpus (MIT) | **Commercial use allowed** (Fully permissive). |
| **Hindi** | **Priyamvada** | CC-BY-NC-SA 4.0 | AI4Bharat IndicNLP (NC) | **Non-commercial only** (Free for non-profit/humanitarian pilot; commercial product release requires dataset waiver from AI4Bharat). |

*Note on Hindi Commercial Alternative*: If a commercial license cannot be negotiated for Priyamvada, **Android Native Google Speech Services (`hi-IN`)** provides a zero-MB, 100% commercially cleared fallback.

---

## 4. Major Risks

1. **Storage / APK Bloat**:
   Bundling English (+60 MB), Arabic (+60 MB), and Hindi (+60 MB) alongside Hausa (+73 MB) would increase total APK download size by ~180 MB.
   *Mitigation*: Implement on-demand language pack downloads via Android Dynamic Feature Modules or app-internal download on first language selection.
2. **Hindi Licensing Clause**:
   Priyamvada's training data carries a Non-Commercial (NC) clause. Using it in a monetized commercial deployment risks copyright infringement.
3. **Arabic Dialectal Diversity**:
   Gulf/Emirati Arabic pronunciation differs from Egyptian or North African dialects. Modern Standard Arabic (Nabra-82M or Android Native) may be preferred for pan-Arab deployment.

---

## 5. Recommended Next Step

> [!IMPORTANT]
> **Final voice selection should be made after the Vision-Link team listens to the samples.**

1. **Team Listening Session**:
   Have product leads, accessibility evaluators, and native language speakers listen to the 9 generated WAV files in `offline-tts-research/voice-samples/multilingual/`.
2. **Sign-off on Voices**:
   Confirm whether the team prefers Amy vs Jenny Dioco for English, Emirati Female vs Nabra-82M for Arabic, and Priyamvada vs Android Native for Hindi.
3. **Phase 2 Implementation**:
   Once approved, proceed to native Kotlin bridge extension to support multi-model switching without touching the existing Hausa engine.
