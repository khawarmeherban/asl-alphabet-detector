---
title: ASL Backend
emoji: 🤟
colorFrom: blue
colorTo: indigo
sdk: docker
pinned: false
---

# ASL Backend

Backend API for the AlphaHand ASL detector.

## Runtime

- Port: `7860`
- Entrypoint: `Dockerfile`
- Health endpoint: `/health`

## Notes

- Set `GEMINI_API_KEY` in Hugging Face Space Secrets if Gemini features are needed.
- Include `asl_model.pkl` in the Space if you want full ML prediction accuracy.
- Without the model file, the backend can still start with heuristic fallback if enabled.
