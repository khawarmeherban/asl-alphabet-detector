# AlphaHand Web App

AlphaHand is an ASL communication workspace built on top of the existing live detector. It keeps the webcam and detection loop central, adds AI-assisted word completion, browser speech, practice mode, Roman Urdu translation, and reverse text-to-sign playback.

## Features

- Real-time ASL alphabet detection with MediaPipe hand tracking and confidence overlays
- Stable-letter confirmation with a 1.5 second hold before appending characters
- Live word builder with Gemini autocomplete and local fallback suggestions
- Smart noisy-input correction before suggestions, with Gemini retry logic and local fallback
- Sentence builder with `SPACE`, `CLEAR`, and `Backspace` controls
- Browser text-to-speech with voice selection and auto-speak on commit
- Confidence bar, top-3 predictions, hand landmarks, and raw-coordinate debug panel
- Dual-hand interaction where a secondary hand can trigger `SPACE`, `CLEAR`, and `SPEAK`
- Camera quality guidance for low light, overlap, and framing issues
- Practice mode with random letter challenges, score tracking, streaks, and hard-mode timer
- Roman Urdu translation through Gemini with a dedicated speak action
- Reverse mode for text or speech input to ASL sign-card playback
- Feature boundaries and modular hooks for safer iteration

## Tech Stack

- React 18
- MediaPipe Hands
- Axios
- Firebase App, Analytics, and Firestore
- Lucide React
- Browser APIs: `getUserMedia`, `speechSynthesis`, `SpeechRecognition`
- Google Gemini API for autocomplete and Roman Urdu translation

## Project Notes

- Gemini API keys are entered in the UI and stored in `sessionStorage` only.
- Firebase is configured client-side for Analytics and Firestore-backed app data sync.
- Gemini failures do not crash the UI. The app falls back to local suggestions and clears translation state safely.
- The upgraded UI is modular and browser-driven, but the sign prediction adapter still uses the existing `/predict` HTTP contract because this repo does not currently include a TF.js browser model artifact. The adapter lives in `frontend/src/features/liveDetection/useLiveDetectionEngine.js` so it can be swapped later without rewriting the page.

## Setup

### 1. Install frontend dependencies

```bash
cd asl-web-app/frontend
npm install
```

### 2. Start the prediction service

```bash
cd asl-web-app/backend
pip install -r requirements.txt
python app.py
```

Default prediction URL:

```env
REACT_APP_API_URL=http://localhost:7860
```

### 3. Start the frontend

```bash
cd asl-web-app/frontend
npm start
```

### 4. Build for production

```bash
cd asl-web-app/frontend
npm run build
```

## Gemini Setup

1. Open the `Live Detection` page.
2. Paste your Gemini API key into the `Gemini API Key` field.
3. The key is saved to `sessionStorage` for the current browser session only.
4. Suggestions and Roman Urdu translation immediately use that key.

## Netlify Notes

- The frontend builds cleanly with `npm run build`.
- MediaPipe assets load from jsDelivr at runtime.
- Firebase web config is included in the frontend and is expected for browser-side app services.
- Firestore should have rules that permit the intended app reads/writes for history and practice sync.
- If you deploy the current repo as-is, make sure `REACT_APP_API_URL` points to a reachable prediction service.
- Gemini calls happen directly from the browser, so use a restricted key appropriate for client-side usage.
- Do not store Gemini API keys in Firebase, Firestore, or Remote Config.

## Screenshots

- `[Placeholder]` Live detection workspace
- `[Placeholder]` Practice mode overlay
- `[Placeholder]` Reverse mode playback grid
- `[Placeholder]` Roman Urdu translation panel

## Folder Guide

```text
frontend/src/features/liveDetection/
  FeatureBoundary.js
  aslReferenceData.js
  constants.js
  featureToggles.js
  geminiService.js
  useLiveDetectionEngine.js
  useSpeechSynthesis.js
frontend/src/services/
  firebase.js
  firebaseSync.js
```

## Validation

- Frontend production build verified with `npm run build`
