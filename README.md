# Vision-Link Mobile MVP

Vision-Link is an AI-powered assistive mobile application designed to interface with smart-glasses and external UVC camera hardware to assist visually impaired users with navigation, real-time object detection, emergency SOS, and voice guidance.

## Architecture & Technology Stack

* **Core Framework**: React Native 0.87.1 (Android-first, CLI native workflow)
* **Language**: TypeScript 5+
* **Design System**: Google Material 3 Design Kit adapted for high-contrast accessibility (WCAG AAA)
* **Navigation**: React Navigation (Native Stack v7)
* **Layout & Screen Primitives**: React Native Safe Area Context & React Native Screens
* **Accessibility**: Screen reader roles, semantic labels, minimum 52dp touch targets, and spoken TTS feedback

## Material 3 Design System & Theme (`src/theme/`)

The design system incorporates Material 3 principles tailored for assistive mobile applications:
* **High-Contrast Palette (`src/theme/tokens.ts`)**: WCAG AAA compliant contrast ratios (Primary Deep Blue `#0D47A1`, Error Alert Red `#B71C1C`, Secondary Forest Green `#2E7D32`, High-Contrast Dark Slate Surface `#0F172A`).
* **Typography Tokens**: Large, highly legible type scales (`display`, `headline`, `titleLarge`, `titleMedium`, `bodyLarge`, `labelLarge`).
* **Touch Targets**: Minimum 52dp button heights (standard primary buttons at 56dp, Emergency SOS at 130dp) with prominent active states.
* **Elevation & Shapes**: Material 3 rounded surfaces (`BorderRadius.lg = 16dp`, `xl = 24dp`).

## Reusable Accessible Components (`src/components/`)

* `AccessibleButton`: M3 buttons supporting `primary`, `secondary`, `tonal`, `outlined`, and `danger` variants, subtitle support, and accessibility props.
* `ScreenHeader`: High-contrast M3 header with screen title, subtitle, and accessible back navigation.
* `AccessibleCard`: Surface cards with outlined, elevated, and filled M3 styling.
* `StatusCard`: Real-time system/device telemetry indicators with color-coded badges and descriptions.
* `ConfirmationDialog`: High-contrast modal dialog preventing accidental triggers (e.g. SOS dispatch).
* `LoadingState`: Screen-reader accessible loading spinner and feedback.
* `ErrorState`: Accessible error alert banner with retry action.

## MVP Screen Flows (`src/screens/`)

1. **Home / Dashboard (`HomeScreen.tsx`)**:
   - System readiness overview (External Camera, Text-to-Speech, GPS telemetry).
   - High-contrast emergency SOS quick-action banner.
   - Large touch navigation buttons for all assistive features.

2. **Navigation & Wayfinding (`NavigationScreen.tsx`)**:
   - Large legible turn-by-turn walking instruction card.
   - Distance (meters) and direction (`straight`, `slight-right`, `sharp-left`, `arrive`) badges.
   - Start / Stop navigation controls and spoken instruction repetition via TTS.
   - Location coordinates telemetry.

3. **External Camera (`CameraScreen.tsx`)**:
   - High-contrast simulated UVC viewfinder viewport with streaming status.
   - External UVC USB OTG camera connection lifecycle (Disconnected, Connecting, Connected, Streaming).
   - Clear architectural boundary isolating the future Android Native USB Host bridge.

4. **Object Detection (`ObjectDetectionScreen.tsx`)**:
   - Simulated detection viewport with bounding boxes.
   - Detected objects list (Person, Chair, Door, Vehicle, Stairs) with confidence percentages, distance estimates, and urgency levels (`low`, `medium`, `high`, `critical`).
   - Voice announcement trigger: reads all detected obstacles aloud through TTS.
   - Clearly marks the Roboflow cloud API path while keeping local YOLOv8 in the roadmap.

5. **Emergency SOS (`SOSScreen.tsx`)**:
   - Giant high-contrast SOS button (130dp touch target).
   - Two-step safety confirmation dialog to prevent accidental triggers.
   - Live dispatch state machine (`idle` → `confirming` → `sending` → `sent` / `cancelled`).
   - Registered emergency contacts list with phone numbers.
   - GPS coordinate dispatch telemetry.

6. **Settings & Preferences (`SettingsScreen.tsx`)**:
   - Vision & accessibility preferences (High Contrast toggle, Haptic feedback toggle).
   - Spoken guidance & TTS settings (Auto-announce hazards, 1.0x / 1.4x speech rate toggle, sample voice test).
   - Obstacle detection sensitivity (High confidence filter, proximity distance alerts).
   - Hardware preferences (USB OTG auto-connect, Bluetooth audio routing status).

## Service Abstraction Layer (`src/features/`)

All external device and cloud services remain behind clean TypeScript interfaces with realistic mock state machines:
* `cameraService`: Complete UVC connection lifecycle, resolution metadata, and frame capture simulation.
* `aiService`: Realistic obstacle detection with bounding boxes, confidence, distance, and urgency; demarcated for Roboflow API integration.
* `navigationService`: Waypoint instruction progression and location telemetry.
* `sosService`: Multi-contact emergency dispatch state machine and location broadcasting.
* `ttsService`: Native Android Text-to-Speech engine simulation with speech rate, pitch, and speaking status listeners.
* `bluetoothService`: Bluetooth audio routing abstraction for smart-glasses earpieces.

## Quality & Validation Commands

### 1. TypeScript Validation
```bash
npx tsc --noEmit
```

### 2. Linting
```bash
npm run lint
```

### 3. Unit Tests
```bash
npm test -- --watchAll=false
```

### 4. Running on Android
```bash
npm run android
```
