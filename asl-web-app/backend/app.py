"""
Flask Backend API for ASL Web Application.
Serves ML model predictions and handles real-time communication.
"""

from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
import os
import pickle
import threading

import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit

PORT = int(os.getenv('PORT', '7860'))
CORS_ORIGINS = os.getenv('CORS_ORIGINS', '*')
SOCKETIO_ASYNC_MODE = os.getenv('SOCKETIO_ASYNC_MODE', 'threading')

app = Flask(__name__)
CORS(app, origins=CORS_ORIGINS)
socketio = SocketIO(app, cors_allowed_origins=CORS_ORIGINS, async_mode=SOCKETIO_ASYNC_MODE)
predict_executor = ThreadPoolExecutor(max_workers=max(2, (os.cpu_count() or 2) // 2))

@app.route("/", methods=["GET"])
def root():
    return jsonify({
        "status": "ok",
        "message": "ASL backend is running",
        "model_loaded": model is not None
    })

# Load ML model with local + deployment-friendly path resolution
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_CANDIDATES = [
    os.getenv('ASL_MODEL_PATH', '').strip(),
    os.path.join(SCRIPT_DIR, 'asl_model.pkl'),
    os.path.join(SCRIPT_DIR, '..', '..', 'data', 'asl_model.pkl'),
]
MODEL_CANDIDATES = [os.path.normpath(path) for path in MODEL_CANDIDATES if path]
MODEL_PATH = next(
    (path for path in MODEL_CANDIDATES if os.path.exists(path)),
    MODEL_CANDIDATES[0] if MODEL_CANDIDATES else 'asl_model.pkl'
)

print(f"[INFO] Model search paths: {MODEL_CANDIDATES}")
model = None
try:
    if os.path.exists(MODEL_PATH):
        with open(MODEL_PATH, 'rb') as f:
            model = pickle.load(f)
        print(f"[OK] ✓ Model loaded successfully from: {MODEL_PATH}")
    else:
        print(f"[WARNING] Model not found. Checked: {MODEL_CANDIDATES}")
        print("[INFO] Please train the model first or copy asl_model.pkl into the backend directory")
except Exception as e:
    print(f"[ERROR] Failed to load model: {e}")
    print("[INFO] Server will run but predictions will not work until model is fixed")
    model = None

# TTS Engine with thread lock - disabled due to Python 3.13 compatibility
tts_lock = threading.Lock()
tts_engine = None
print("[INFO] Text-to-Speech disabled (Python 3.13 compatibility)")

# Thread-safe shared state
conversation_history = []
MAX_HISTORY = 500
CACHE_LIMIT = 256
MODEL_FEATURES = getattr(model, 'n_features_in_', None)
history_lock = threading.Lock()
cache_lock = threading.Lock()
prediction_cache = OrderedDict()

# Word prediction dictionary (simple implementation)
COMMON_WORDS = [
    'hello', 'hi', 'thank', 'you', 'please', 'sorry', 'yes', 'no',
    'good', 'morning', 'afternoon', 'evening', 'night', 'how', 'are',
    'what', 'when', 'where', 'why', 'who', 'help', 'need', 'want'
]

def normalize_landmarks(hand_landmarks_list):
    """Normalize hand landmarks"""
    coords = [[lm.x, lm.y] for lm in hand_landmarks_list]
    coords = np.array(coords)
    wrist = coords[0]
    normalized = coords - wrist
    x_min, y_min = normalized.min(axis=0)
    x_max, y_max = normalized.max(axis=0)
    scale = max(x_max - x_min, y_max - y_min)
    if scale > 0:
        normalized = normalized / scale
    return normalized.flatten()

def predict_words(current_text):
    """Simple word prediction based on current text."""
    if not current_text:
        return COMMON_WORDS[:5]

    last_word = current_text.split()[-1].lower() if current_text.split() else ""
    predictions = [w for w in COMMON_WORDS if w.startswith(last_word)]
    return predictions[:5] if predictions else COMMON_WORDS[:5]

def _prepare_features(landmarks):
    arr = np.asarray(landmarks, dtype=np.float32).flatten()
    if arr.size == 0:
        raise ValueError('No landmarks provided')
    if MODEL_FEATURES and arr.size != MODEL_FEATURES:
        raise ValueError(f'Expected {MODEL_FEATURES} features, received {arr.size}')
    return arr.reshape(1, -1)

def _cache_key(landmarks):
    arr = np.asarray(landmarks, dtype=np.float32).flatten()
    return tuple(np.round(arr[:min(12, arr.size)], 3))

def predict_landmarks_cached(landmarks):
    """Run a fast cached prediction for one landmark vector."""
    if model is None:
        raise RuntimeError('Model not loaded')

    cache_key = _cache_key(landmarks)
    with cache_lock:
        cached = prediction_cache.get(cache_key)
        if cached is not None:
            prediction_cache.move_to_end(cache_key)
            return {**cached, 'cached': True}

    features = _prepare_features(landmarks)
    probabilities = model.predict_proba(features)[0]
    best_index = int(np.argmax(probabilities))
    result = {
        'prediction': str(model.classes_[best_index]),
        'confidence': float(probabilities[best_index]),
        'timestamp': datetime.now().isoformat(),
        'cached': False
    }

    with cache_lock:
        prediction_cache[cache_key] = result
        prediction_cache.move_to_end(cache_key)
        while len(prediction_cache) > CACHE_LIMIT:
            prediction_cache.popitem(last=False)

    return result

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'model_loaded': model is not None,
        'feature_count': MODEL_FEATURES,
        'cache_size': len(prediction_cache),
        'timestamp': datetime.now().isoformat()
    })

@app.route('/predict', methods=['POST'])
def predict():
    """Predict one ASL sign from landmarks."""
    try:
        data = request.get_json(silent=True) or {}
        landmarks = data.get('landmarks')
        if not isinstance(landmarks, list) or not landmarks:
            return jsonify({'error': 'Invalid or missing landmarks'}), 400

        result = predict_executor.submit(predict_landmarks_cached, landmarks).result()
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/predict/batch', methods=['POST'])
def predict_batch():
    """Predict multiple landmark sets in one request."""
    try:
        data = request.get_json(silent=True) or {}
        samples = data.get('samples') or data.get('items') or []
        if not isinstance(samples, list) or not samples:
            return jsonify({'error': 'Provide a non-empty samples list'}), 400

        results = []
        for sample in samples[:32]:
            landmarks = sample.get('landmarks') if isinstance(sample, dict) else sample
            try:
                results.append(predict_landmarks_cached(landmarks))
            except Exception as exc:
                results.append({'error': str(exc)})

        return jsonify({
            'results': results,
            'count': len(results),
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/predict-words', methods=['POST'])
def predict_words_endpoint():
    """Get word predictions based on current text"""
    try:
        data = request.json
        current_text = data.get('text', '')
        predictions = predict_words(current_text)
        
        return jsonify({
            'predictions': predictions,
            'timestamp': datetime.now().isoformat()
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/speak', methods=['POST'])
def speak():
    """Text-to-speech endpoint"""
    try:
        if not tts_engine:
            return jsonify({'error': 'TTS not available'}), 503
            
        data = request.json
        text = data.get('text', '')
        
        if not text:
            return jsonify({'error': 'No text provided'}), 400
        
        # Limit text length for performance
        if len(text) > 500:
            text = text[:500] + '...'
        
        def speak_async():
            with tts_lock:  # Thread-safe TTS
                tts_engine.say(text)
                tts_engine.runAndWait()
        
        thread = threading.Thread(target=speak_async, daemon=True)
        thread.start()
        
        return jsonify({
            'status': 'speaking',
            'text': text,
            'timestamp': datetime.now().isoformat()
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/history', methods=['GET'])
def get_history():
    """Get conversation history."""
    with history_lock:
        history_snapshot = list(conversation_history)
    return jsonify({
        'history': history_snapshot,
        'count': len(history_snapshot)
    })

@app.route('/history', methods=['POST'])
def add_history():
    """Add to conversation history."""
    try:
        data = request.get_json(silent=True) or {}
        text = data.get('text', '').strip()

        with history_lock:
            if not text or (conversation_history and conversation_history[-1].get('text') == text):
                return jsonify({'status': 'skipped', 'total': len(conversation_history)})

            conversation_history.append({
                'text': text,
                'speaker': data.get('speaker', 'User'),
                'mode': data.get('mode', 'ASL'),
                'timestamp': datetime.now().isoformat()
            })

            while len(conversation_history) > MAX_HISTORY:
                conversation_history.pop(0)

            total = len(conversation_history)

        return jsonify({'status': 'added', 'total': total})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/history', methods=['DELETE'])
def clear_history():
    """Clear conversation history."""
    with history_lock:
        conversation_history.clear()
    return jsonify({'status': 'cleared'})

@app.route('/statistics', methods=['GET'])
def get_statistics():
    """Get usage statistics."""
    with history_lock:
        history_snapshot = list(conversation_history)

    if not history_snapshot:
        return jsonify({
            'total_messages': 0,
            'asl_messages': 0,
            'voice_messages': 0,
            'letter_frequency': {}
        })

    asl_count = sum(1 for h in history_snapshot if h['mode'] == 'ASL')
    voice_count = len(history_snapshot) - asl_count
    all_text = ''.join(item['text'].lower() for item in history_snapshot)

    letter_freq = {}
    for char in all_text:
        if char.isalpha():
            letter_freq[char] = letter_freq.get(char, 0) + 1

    return jsonify({
        'total_messages': len(history_snapshot),
        'asl_messages': asl_count,
        'voice_messages': voice_count,
        'letter_frequency': letter_freq,
        'most_used_letters': sorted(letter_freq.items(), key=lambda x: x[1], reverse=True)[:10]
    })

# Gesture Control Endpoints
@app.route('/gesture/brightness', methods=['POST'])
def set_brightness():
    """Set system brightness (simulated for web)"""
    try:
        data = request.json
        level = data.get('level', 50)
        level = max(0, min(100, int(level)))
        
        return jsonify({
            'status': 'success',
            'brightness': level,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/gesture/volume', methods=['POST'])
def set_volume():
    """Set system volume (simulated for web)"""
    try:
        data = request.json
        level = data.get('level', 50)
        muted = data.get('muted', False)
        level = max(0, min(100, int(level)))
        
        return jsonify({
            'status': 'success',
            'volume': level,
            'muted': muted,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/gesture/media', methods=['POST'])
def control_media():
    """Control media playback (simulated for web)"""
    try:
        data = request.json
        action = data.get('action', 'pause')  # play, pause, next, prev
        
        return jsonify({
            'status': 'success',
            'action': action,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# WebSocket events for real-time communication
@socketio.on('connect')
def handle_connect():
    print('[WebSocket] Client connected')
    emit('connection_response', {'status': 'connected'})

@socketio.on('disconnect')
def handle_disconnect():
    print('[WebSocket] Client disconnected')

@socketio.on('asl_prediction')
def handle_asl_prediction(data):
    """Real-time ASL prediction via WebSocket."""
    try:
        landmarks = (data or {}).get('landmarks')
        if not landmarks:
            emit('error', {'message': 'Missing landmarks'})
            return

        result = predict_landmarks_cached(landmarks)
        emit('prediction_result', result)
    except Exception as e:
        emit('error', {'message': str(e)})

if __name__ == '__main__':
    print("\n" + "="*60)
    print("ASL Web Application - Backend Server")
    print("="*60)
    print(f"[OK] Starting Flask server on http://0.0.0.0:{PORT}")
    print("[OK] WebSocket enabled for real-time communication")
    print("="*60 + "\n")
    
    # Use socketio.run for WebSocket support
    try:
        socketio.run(app, host='0.0.0.0', port=PORT, debug=False, use_reloader=False, allow_unsafe_werkzeug=True)
    except Exception as e:
        print(f"[ERROR] Server failed to start: {e}")
        import traceback
        traceback.print_exc()
