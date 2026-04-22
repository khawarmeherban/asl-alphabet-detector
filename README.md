# AlphaHand — Production-ready ASL Workspace

AlphaHand is a real-time ASL (American Sign Language) alphabet detector and communication workspace. This repository contains:

- A Flask backend that serves an ML classifier for hand landmark features and provides prediction, health, and gesture endpoints.
- A React frontend (`asl-web-app/frontend`) that runs MediaPipe Hands in the browser, debounces predictions, and provides a demo workspace with practice, suggestions, TTS, and gesture-controlled media.
- Python utilities for dataset processing and model training (kept for reference and local development).

This README consolidates the key project details and the most important developer and deployment tasks.

## Key Features

- Real-time ASL alphabet detection with MediaPipe hand tracking and confidence overlays
- Stable-letter confirmation (1–1.5s hold / temporal consensus) to avoid flicker
- Live word builder with on-device fallback suggestions and optional Gemini autocomplete
- Dual-hand interaction: secondary hand can trigger `SPACE`, `CLEAR`, and `SPEAK` actions
- Practice mode with randomized challenges, scoring, and streaks
- Reverse mode for text → sign playback (ASL card renderer)
- Browser Text-to-Speech and optional speech recognition helpers

## Important Files

- `asl-web-app/backend/app.py` — Flask backend and WebSocket handlers (prediction endpoints)
- `asl-web-app/backend/asl_feature_utils.py` — feature engineering and model helpers
- `asl-web-app/frontend/src/features/liveDetection/useLiveDetectionEngine.js` — MediaPipe integration and prediction adapter
- `inference_classifier.py` — training and local inference script (reference)

## Local Development

1. Backend (Python)

```bash
cd asl-web-app/backend
python -m venv .venv   # optional: create virtualenv
.\.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

The backend listens on port `7860` by default. Use `/health` to verify model load and status.

2. Frontend (React)

```bash
cd asl-web-app/frontend
npm install
npm start
```

Set `REACT_APP_API_URL` to point to the backend (e.g., `http://localhost:7860`) in your environment or in a local `.env`.

## Deployment Notes

- Frontend: Netlify is used in production. Build with `npm run build` and configure Netlify to serve files from `asl-web-app/frontend/build`.
- Backend: Hugging Face Spaces (Docker) or a standard host. Ensure the trained model `asl_model.pkl` is present in the backend working directory or configure `ASL_MODEL_PATH`.
- Important: If the backend cannot find the model, `/predict` and `/predict/batch` now return `503` and `/health` reports `model_loaded: false`.

## Cleanup & Repository Hygiene

- The repo should not include local virtual environments or build artifacts. Consider adding these to `.gitignore`:

```
.venv/
asl-web-app/frontend/build/
__pycache__/
.DS_Store
node_modules/
.env
.env.local
.sixth/
```

I will remove obvious generated artifacts (build output, bytecode caches) and consolidate docs into this README unless you prefer separate docs.

## Troubleshooting

- If `/predict` returns 503, the model file is missing or failed to load — check backend logs and ensure `asl_model.pkl` exists.
- If MediaPipe causes main-thread jank, ensure the frontend is using the non-blocking send pattern and the model server is healthy.

## Next Steps I Took

- Hardened backend inference by offloading `model.predict_proba` to a thread pool and added a configurable timeout.
- Made MediaPipe frame handling non-blocking in the frontend hook to reduce UI jank.

For deployment pushes or PRs, tell me whether to push directly to `main` or create a feature branch and PR.
