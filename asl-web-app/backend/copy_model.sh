#!/usr/bin/env bash
set -euo pipefail

# Copy the trained model to backend for deployment.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE="$(cd "$SCRIPT_DIR/../.." && pwd)/data/asl_model.pkl"
DESTINATION="$SCRIPT_DIR/asl_model.pkl"

if [ ! -f "$SOURCE" ]; then
  echo "Model not found at ../../data/asl_model.pkl." >&2
  echo "Train it first with 'python inference_classifier.py' or set ASL_MODEL_PATH in .env." >&2
  exit 1
fi

cp "$SOURCE" "$DESTINATION"
echo "Copied trained ASL model to $DESTINATION"
