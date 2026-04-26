FROM python:3.10-slim

# Install runtime libraries needed by NumPy / scikit-learn / MediaPipe wheels.
USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgomp1 \
    libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user (recommended by HF)
RUN useradd -m -u 1000 user
USER user
ENV PATH="/home/user/.local/bin:$PATH"
ENV SOCKETIO_ASYNC_MODE=threading

WORKDIR /app

# Copy requirements and install dependencies
COPY --chown=user ./requirements.txt requirements.txt
RUN pip install --no-cache-dir --upgrade -r requirements.txt

# Copy the rest of the code
COPY --chown=user . /app

# Expose the port required by Hugging Face Spaces
EXPOSE 7860

# Start the Flask app with plain Gunicorn threads.
# The frontend uses HTTP endpoints for prediction, which keeps deployment simpler
# and more reliable than eventlet-based SocketIO workers on Spaces.
CMD ["gunicorn", "--workers", "1", "--threads", "8", "--timeout", "120", "-b", "0.0.0.0:7860", "app:app"]
