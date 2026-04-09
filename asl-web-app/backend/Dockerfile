FROM python:3.10-slim

# Create a non-root user (recommended by HF)
RUN useradd -m -u 1000 user
USER user
ENV PATH="/home/user/.local/bin:$PATH"
ENV SOCKETIO_ASYNC_MODE=eventlet

WORKDIR /app

# Copy requirements and install dependencies
COPY --chown=user ./requirements.txt requirements.txt
RUN pip install --no-cache-dir --upgrade -r requirements.txt

# Copy the rest of the code
COPY --chown=user . /app

# Expose the port required by Hugging Face Spaces
EXPOSE 7860

# Start the Flask app with gunicorn and eventlet for SocketIO support
CMD ["gunicorn", "--worker-class", "eventlet", "-w", "1", "-b", "0.0.0.0:7860", "app:app"]
