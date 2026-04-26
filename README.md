# AlphaHand — ASL Alphabet Detector

AlphaHand is a premium real-time ASL alphabet communication platform. It combines webcam-based hand tracking, a Flask ML inference backend, word building, speech output, learning tools, analytics, and a gesture-powered virtual piano into one exhibition-ready accessibility project.

The product goal is simple: help Deaf, hard-of-hearing, and hearing users bridge communication gaps with a fast, visual, and approachable ASL alphabet workflow.

## Key Features

- **Live ASL Detection** — webcam hand tracking with MediaPipe, backend alphabet prediction, confidence display, and temporal smoothing.
- **Word Builder** — stable detected letters become words and sentences with backspace, commit, and suggestion controls.
- **Speech Output** — browser Text-to-Speech can read committed words or full sentences aloud.
- **AI Assistance** — Gemini-backed correction, word suggestions, and Roman Urdu translation with local/backend fallbacks.
- **Learning Mode** — guided A–Z practice cards, completion tracking, and recall drills for students and demos.
- **Gesture Virtual Piano** — touchless piano, synth, and drum modes powered by hand motion and the native Web Audio API.
- **Communication Suite** — ASL-to-text, voice-to-text, text playback, copy, save, and history flows.
- **Analytics & History** — conversation history, message counts, and letter-frequency insights.
- **Deployment Ready** — Netlify frontend configuration and Hugging Face Spaces backend configuration.

## Current Functionality Status

| Area | Status | Notes |
| --- | --- | --- |
| Frontend build | Working | Verified with `npm run build`. |
| Backend health/API | Working | `/health`, `/predict-words`, `/history`, and `/statistics` respond locally. |
| ASL prediction | Demo fallback active | `/predict` works with a geometry-based fallback if no model exists; add `asl_model.pkl` for full A–Z ML accuracy. |
| Gemini features | Optional | Requires `GEMINI_API_KEY` in `asl-web-app/backend/.env`; local fallbacks keep the UI stable. |
| Virtual Piano | Working | Uses browser Web Audio API, no external audio package required. |

## Tech Stack

### Frontend

- React 18
- React Router
- Tailwind CSS
- MediaPipe Hands
- Lucide React
- Recharts
- Firebase web SDK
- Browser APIs: `getUserMedia`, `speechSynthesis`, `SpeechRecognition`, Web Audio

### Backend

- Flask
- Flask-CORS
- Flask-SocketIO
- NumPy
- Scikit-learn
- MediaPipe/OpenCV utilities
- Google Gemini API
- Gunicorn/Eventlet for deployment

### ML Pipeline

1. The browser captures webcam frames.
2. MediaPipe extracts 21 hand landmarks.
3. Landmarks are normalized client-side.
4. Flask prepares the feature vector expected by the trained model.
5. The classifier returns top predictions and confidence values.
6. Temporal consensus filters flicker before letters enter the word builder.

## Project Structure

```text
asl-alphabet-detector/
├── README.md
├── asl_feature_utils.py
├── data_collector.py
├── inference_classifier.py
├── process_dataset.py
├── docs/
├── asl-web-app/
│   ├── backend/
│   │   ├── app.py
│   │   ├── requirements.txt
│   │   ├── Dockerfile
│   │   └── Procfile
│   └── frontend/
│       ├── package.json
│       └── src/
│           ├── components/
│           ├── features/
│           └── pages/
```

## Setup

### 1. Backend

```bash
cd asl-web-app/backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Default backend URL:

```text
http://localhost:7860
```

### 2. Frontend

```bash
cd asl-web-app/frontend
npm install
npm start
```

Default frontend URL:

```text
http://localhost:3000
```

### 3. Environment Variables

Frontend:

```env
REACT_APP_API_URL=http://localhost:7860
```

Backend:

```env
PORT=7860
CORS_ORIGINS=*
ASL_MODEL_PATH=./asl_model.pkl
GEMINI_API_KEY=your_optional_key
GEMINI_MODEL=gemini-2.5-flash
ENABLE_HEURISTIC_FALLBACK=true
```

Do not commit real `.env` files or API keys.

## Model Setup

The production detector is designed for a trained model file named `asl_model.pkl`. If the model is missing, the backend can still run Live Detection with `ENABLE_HEURISTIC_FALLBACK=true`, which uses a lightweight geometry-based demo predictor for common ASL alphabet shapes. This is useful for exhibitions and UI testing, but a trained model is required for full A–Z accuracy.

If you already have a trained model:

```powershell
cd asl-web-app/backend
.\copy_model.ps1
```

Expected model locations:

- `data/asl_model.pkl`
- `asl-web-app/backend/asl_model.pkl`
- custom path via `ASL_MODEL_PATH`

If you need to train the model:

```bash
python process_dataset.py
python inference_classifier.py
```

The generated file should be copied or referenced so the backend can load it before `/predict` will return alphabet predictions.

## Usage Guide

- Open **Live Detection** to start ASL alphabet recognition.
- Allow camera access and keep your hand centered in good lighting.
- Hold a sign steady until it becomes a stable prediction.
- Use **Commit Word**, **Backspace**, and suggestions to build sentences.
- Use **Speak Sentence** for Text-to-Speech.
- Open **Learning Mode** for guided A–Z practice.
- Open **Virtual Music** to play notes with fingertip motion.
- Open **Analytics** and **History** to review usage.

## API Overview

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/` | GET | Backend status |
| `/health` | GET | Model, feature, cache, and setup diagnostics |
| `/predict` | POST | Single ASL landmark prediction |
| `/predict/batch` | POST | Batch landmark prediction |
| `/predict-words` | POST | Local word/phrase suggestions |
| `/gemini/correct` | POST | AI correction for noisy signed text |
| `/gemini/suggestions` | POST | AI word suggestions |
| `/gemini/translate-urdu` | POST | Roman Urdu translation |
| `/history` | GET/POST/DELETE | Conversation history |
| `/statistics` | GET | Usage statistics |

## Deployment

### Frontend: Netlify

- Base directory: `asl-web-app/frontend`
- Build command: `npm run build`
- Publish directory: `asl-web-app/frontend/build`
- Set `REACT_APP_API_URL` to the live Hugging Face backend URL.

### Backend: Hugging Face Spaces

- Use `asl-web-app/backend` files.
- Ensure `asl_model.pkl` is present or `ASL_MODEL_PATH` points to it.
- Set `GEMINI_API_KEY` only in secure Space secrets if AI assistance is needed.
- The backend listens on port `7860`.

## Accessibility Impact

AlphaHand is designed for inclusive communication in classrooms, exhibitions, healthcare desks, public service counters, and family conversations. It turns a technical ML demo into a usable assistive interface by combining detection, confirmation, suggestions, speech, translation, and learning in one flow.

## Validation

Run these checks before presenting or deploying:

```bash
cd asl-web-app/frontend
npm run build
```

```bash
cd asl-web-app/backend
python app.py
```

Then verify:

- `GET http://localhost:7860/health`
- `POST http://localhost:7860/predict-words`
- Live Detection camera permission and backend connection
- Model loaded state in `/health`
