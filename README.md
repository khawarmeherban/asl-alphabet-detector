# AlphaHand

AlphaHand upgrades the existing ASL alphabet detector into a broader communication tool for Deaf and Hearing users. The current repo includes the original Python model pipeline plus the upgraded React web app.

## What’s Included

- ASL alphabet detection with MediaPipe landmark extraction
- Live communication workspace in `asl-web-app/frontend`
- Gemini-assisted autocomplete and Roman Urdu translation
- Browser speech synthesis and speech recognition helpers
- Practice mode and reverse text-to-sign playback
- Existing Python utilities for dataset processing, training, and local inference

## Web App

The main web experience lives in [asl-web-app/README.md](asl-web-app/README.md).

## Python Utilities

- `process_dataset.py`: dataset preprocessing
- `inference_classifier.py`: model training and local inference
- `asl_translator.py`: ASL to text and speech utility
- `asl_bidirectional.py`: bidirectional desktop prototype

## Current Architecture Note

The upgraded frontend is modular and browser-heavy, but the sign prediction path still points to the existing `/predict` API because there is no TF.js model artifact committed in this repo yet. The UI adapter is isolated so a browser-only model can replace it later without redesigning the interface.
