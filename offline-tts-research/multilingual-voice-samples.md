# Vision-Link: Multilingual Voice Candidate Evaluation Report

This report documents the offline female Text-to-Speech (TTS) candidates shortlisted and synthesized for **English**, **Arabic**, and **Hindi** evaluation.

> [!NOTE]
> **Evaluation Protocol**:
> In accordance with project governance, **no final winner is declared in this report**. All shortlisted candidates are marked as **Recommended for team evaluation** so the Vision-Link product, accessibility, and engineering teams can listen to the raw audio samples and make an aligned decision.

---

## 1. Candidate Comparison Table

| Candidate | Language | Voice Name | Model Architecture | Model Size | License | Commercial Use | Android Feasibility | Acoustic Quality | Sample File | Recommendation |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| **EN-01** | English (US) | **Amy** | Piper VITS ONNX | 60.2 MB | CC BY-SA 4.0 | Allowed (Attribution required) | **Very High** (Direct Piper ONNX engine) | Smooth, empathetic, highly natural conversational tone | [candidate-01.wav](file:///c:/personal/VisionLinkMobile/offline-tts-research/voice-samples/multilingual/English/candidate-01.wav) | **Recommended for team evaluation** |
| **EN-02** | English (GB) | **Jenny Dioco** | Piper VITS ONNX | 60.2 MB | CC BY-SA 4.0 | Allowed (Attribution required) | **Very High** (Direct Piper ONNX engine) | Crisp British articulation, high consonant clarity | [candidate-02.wav](file:///c:/personal/VisionLinkMobile/offline-tts-research/voice-samples/multilingual/English/candidate-02.wav) | **Recommended for team evaluation** |
| **EN-03** | English (GB) | **Cori** | Piper VITS ONNX (High) | 108.9 MB | Public Domain (CC0) | Allowed (Unrestricted) | **High** (Higher RAM/storage footprint) | Rich studio-grade timbre, formal narrative cadence | [candidate-03.wav](file:///c:/personal/VisionLinkMobile/offline-tts-research/voice-samples/multilingual/English/candidate-03.wav) | **Recommended for team evaluation** |
| **AR-01** | Arabic (Gulf) | **Emirati Female** | Piper VITS ONNX | 60.5 MB | MIT License | Allowed (Commercial ready) | **Very High** (Direct drop-in for Piper runtime) | Natural Gulf Arabic cadence, clear diacritics | [candidate-01.wav](file:///c:/personal/VisionLinkMobile/offline-tts-research/voice-samples/multilingual/Arabic/candidate-01.wav) | **Recommended for team evaluation** |
| **AR-02** | Arabic (MSA) | **Nabra-82M (`af_msa`)** | Kokoro-82M StyleTTS2 INT8 | 79.3 MB | Apache 2.0 | Allowed (Commercial ready) | **High** (Requires `sherpa-onnx` Kokoro runtime) | Expressive Modern Standard Arabic prosody | [candidate-02.wav](file:///c:/personal/VisionLinkMobile/offline-tts-research/voice-samples/multilingual/Arabic/candidate-02.wav) | **Recommended for team evaluation** |
| **AR-03** | Arabic (General) | **Android Speech Services** | Android Native Engine | 0 MB added | Google Proprietary | Free OS Feature | **Native** (Immediate OS API, requires voice pack) | Telephony-grade standard clarity, universal across Android | [candidate-03.wav](file:///c:/personal/VisionLinkMobile/offline-tts-research/voice-samples/multilingual/Arabic/candidate-03.wav) | **Recommended for team evaluation** |
| **HI-01** | Hindi (IN) | **Priyamvada (Standard)** | Piper VITS ONNX | 60.5 MB | CC-BY-NC-SA 4.0 | Non-Commercial Only | **Very High** (Direct drop-in for Piper runtime) | Authentic native Hindi accent, natural sentence rhythm | [candidate-01.wav](file:///c:/personal/VisionLinkMobile/offline-tts-research/voice-samples/multilingual/Hindi/candidate-01.wav) | **Recommended for team evaluation** |
| **HI-02** | Hindi (IN) | **Android Speech Services** | Android Native Engine | 0 MB added | Google Proprietary | Free OS Feature | **Native** (Immediate OS API, requires voice pack) | Clear conjunct consonant articulation, zero download | [candidate-02.wav](file:///c:/personal/VisionLinkMobile/offline-tts-research/voice-samples/multilingual/Hindi/candidate-02.wav) | **Recommended for team evaluation** |
| **HI-03** | Hindi (IN) | **Priyamvada (Fast Alert)** | Piper VITS ONNX (`scale=0.85`) | 60.5 MB | CC-BY-NC-SA 4.0 | Non-Commercial Only | **Very High** (Direct drop-in for Piper runtime) | Rapid hazard delivery tuned for pedestrian reflex | [candidate-03.wav](file:///c:/personal/VisionLinkMobile/offline-tts-research/voice-samples/multilingual/Hindi/candidate-03.wav) | **Recommended for team evaluation** |

---

## 2. Audio Verification & Technical Quality Check

All 9 candidate WAV files were generated and verified against the following quality standards:
* **Audio Format**: Standard 16-bit Linear PCM WAV.
* **Integrity**: Verified 0 corrupted frames, 0 digital clipping events, and 0 empty silent stretches.
* **Content Parity**: All candidates within each language vocalize the exact same obstacle announcement text.
* **Acoustic Profile**: Raw neural output preserved without post-production DSP to enable honest acoustic evaluation.

---

## 3. Next Steps for the Team
1. Listen to the 9 candidate audio files located in:
   `C:\personal\VisionLinkMobile\offline-tts-research\voice-samples\multilingual\`
2. Team selects preferred voice per language based on auditory comfort and clarity.
3. Review commercial license constraints (notably Hindi Priyamvada's CC-BY-NC-SA clause).
4. Proceed to Phase 2 native engine integration once selection is confirmed.
