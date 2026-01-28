"""
Flask Backend API for ASL Web Application
Serves ML model predictions and handles real-time communication
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import numpy as np
import pickle
import os
from datetime import datetime
import mediapipe as mp
import cv2
import base64
import io
from PIL import Image
import pyttsx3
import threading

app = Flask(__name__)
CORS(app, origins=['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'])
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# Load ML model
MODEL_PATH = '../../data/asl_model.pkl'
model = None
try:
    if os.path.exists(MODEL_PATH):
        with open(MODEL_PATH, 'rb') as f:
            model = pickle.load(f)
        print("[OK] Model loaded successfully")
    else:
        print("[WARNING] Model not found. Please train the model first.")
except Exception as e:
    print(f"[ERROR] Failed to load model: {e}")
    print("[INFO] Server will run but predictions will not work until model is fixed")
    model = None

# Initialize MediaPipe
BaseOptions = mp.tasks.BaseOptions
HandLandmarker = mp.tasks.vision.HandLandmarker
HandLandmarkerOptions = mp.tasks.vision.HandLandmarkerOptions
VisionRunningMode = mp.tasks.vision.RunningMode

# TTS Engine with thread lock - DISABLED due to Python 3.13 compatibility
tts_lock = threading.Lock()
tts_engine = None
# Commenting out due to pyttsx3 issues with Python 3.13
# try:
#     tts_engine = pyttsx3.init()
#     tts_engine.setProperty('rate', 150)
#     tts_engine.setProperty('volume', 0.9)
#     print("[OK] Text-to-Speech initialized")
# except Exception as e:
#     print(f"[WARNING] TTS initialization failed: {e}")
#     print("[INFO] Speech features will be disabled")
print("[INFO] Text-to-Speech disabled (Python 3.13 compatibility)")

# Conversation history (limit to 500 items for memory efficiency)
conversation_history = []
MAX_HISTORY = 500

# Prediction cache for performance
prediction_cache = {}

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
    """Simple word prediction based on current text"""
    if not current_text:
        return COMMON_WORDS[:5]
    
    last_word = current_text.split()[-1].lower() if current_text.split() else ""
    predictions = [w for w in COMMON_WORDS if w.startswith(last_word)]
    return predictions[:5] if predictions else COMMON_WORDS[:5]

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'model_loaded': model is not None,
        'timestamp': datetime.now().isoformat()
    })

@app.route('/predict', methods=['POST'])
def predict():
    """Predict ASL sign from landmarks"""
    try:
        data = request.json
        landmarks = data.get('landmarks')
        
        if not landmarks or not model:
            return jsonify({'error': 'Invalid data or model not loaded'}), 400
        
        # Create cache key from landmarks
        cache_key = tuple(round(x, 3) for x in landmarks[:10])  # First 10 for efficiency
        
        # Check cache first
        if cache_key in prediction_cache:
            cached_result = prediction_cache[cache_key]
            return jsonify(cached_result)
        
        # Normalize and predict
        features = np.array(landmarks).reshape(1, -1)
        prediction = model.predict(features)[0]
        confidence = float(model.predict_proba(features).max())
        
        result = {
            'prediction': prediction,
            'confidence': confidence,
            'timestamp': datetime.now().isoformat()
        }
        
        # Cache result (limit cache size)
        if len(prediction_cache) > 100:
            prediction_cache.clear()
        prediction_cache[cache_key] = result
        
        return jsonify(result)
    
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
    """Get conversation history"""
    return jsonify({
        'history': conversation_history,
        'count': len(conversation_history)
    })

@app.route('/history', methods=['POST'])
def add_history():
    """Add to conversation history"""
    try:
        data = request.json
        text = data.get('text', '').strip()
        
        # Skip empty or duplicate messages
        if not text or (conversation_history and conversation_history[-1].get('text') == text):
            return jsonify({'status': 'skipped', 'total': len(conversation_history)})
        
        conversation_history.append({
            'text': text,
            'speaker': data.get('speaker', 'User'),
            'mode': data.get('mode', 'ASL'),
            'timestamp': datetime.now().isoformat()
        })
        
        # Maintain history limit
        if len(conversation_history) > MAX_HISTORY:
            conversation_history.pop(0)
        
        return jsonify({
            'status': 'added',
            'total': len(conversation_history)
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/history', methods=['DELETE'])
def clear_history():
    """Clear conversation history"""
    conversation_history.clear()
    return jsonify({'status': 'cleared'})

@app.route('/statistics', methods=['GET'])
def get_statistics():
    """Get usage statistics"""
    if not conversation_history:
        return jsonify({
            'total_messages': 0,
            'asl_messages': 0,
            'voice_messages': 0,
            'letter_frequency': {}
        })
    
    asl_count = sum(1 for h in conversation_history if h['mode'] == 'ASL')
    voice_count = len(conversation_history) - asl_count
    
    # Calculate letter frequency
    all_text = ''.join([h['text'].lower() for h in conversation_history])
    letter_freq = {}
    for char in all_text:
        if char.isalpha():
            letter_freq[char] = letter_freq.get(char, 0) + 1
    
    return jsonify({
        'total_messages': len(conversation_history),
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
    """Real-time ASL prediction via WebSocket"""
    try:
        landmarks = data.get('landmarks')
        if landmarks and model:
            features = np.array(landmarks).reshape(1, -1)
            prediction = model.predict(features)[0]
            confidence = float(model.predict_proba(features).max())
            
            emit('prediction_result', {
                'prediction': prediction,
                'confidence': confidence,
                'timestamp': datetime.now().isoformat()
            })
    except Exception as e:
        emit('error', {'message': str(e)})

if __name__ == '__main__':
    print("\n" + "="*60)
    print("ASL Web Application - Backend Server")
    print("="*60)
    print("[OK] Starting Flask server on http://localhost:5000")
    print("[OK] WebSocket enabled for real-time communication")
    print("="*60 + "\n")
    
    # Temporarily use app.run instead of socketio.run for debugging
    app.run(host='0.0.0.0', port=5000, debug=False, use_reloader=False, threaded=True)
