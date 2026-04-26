"""
Flask Backend API for ASL Web Application.
Serves ML model predictions and handles real-time communication.
"""

from collections import Counter, OrderedDict, deque
from datetime import datetime
import hashlib
import os
import pickle
import sys
import threading

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.normpath(os.path.join(BACKEND_DIR, '..', '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from dotenv import load_dotenv
import google.generativeai as genai

from asl_feature_utils import prepare_model_features, top_k_predictions
import concurrent.futures

load_dotenv(os.path.join(BACKEND_DIR, '.env'))
PORT = int(os.getenv('PORT', '7860'))
CORS_ORIGINS = os.getenv('CORS_ORIGINS', '*')
SOCKETIO_ASYNC_MODE = os.getenv('SOCKETIO_ASYNC_MODE', 'threading')
MIN_PREDICTION_CONFIDENCE = float(os.getenv('MIN_PREDICTION_CONFIDENCE', '0.58'))
MIN_PREDICTION_MARGIN = float(os.getenv('MIN_PREDICTION_MARGIN', '0.03'))
TEMPORAL_WINDOW_SIZE = int(os.getenv('TEMPORAL_WINDOW_SIZE', '6'))
TEMPORAL_MIN_HITS = int(os.getenv('TEMPORAL_MIN_HITS', '3'))
TEMPORAL_MIN_RATIO = float(os.getenv('TEMPORAL_MIN_RATIO', '0.55'))
SESSION_STATE_LIMIT = int(os.getenv('SESSION_STATE_LIMIT', '256'))
PREDICT_WORKERS = int(os.getenv('PREDICT_WORKERS', '2'))
PREDICT_TIMEOUT = float(os.getenv('PREDICT_TIMEOUT', '3.0'))
ENABLE_HEURISTIC_FALLBACK = os.getenv('ENABLE_HEURISTIC_FALLBACK', 'true').strip().lower() not in {'0', 'false', 'no'}
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '').strip()
GEMINI_MODEL = os.getenv('GEMINI_MODEL', 'gemini-2.5-flash').strip()

app = Flask(__name__)
CORS(app, origins=CORS_ORIGINS)
socketio = SocketIO(app, cors_allowed_origins=CORS_ORIGINS, async_mode=SOCKETIO_ASYNC_MODE)

# Executor for offloading model inference so request threads are not blocked
prediction_executor = concurrent.futures.ThreadPoolExecutor(max_workers=PREDICT_WORKERS)

# Gemini server-side setup (no frontend key exposure)
gemini_client = None
if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        gemini_client = genai.GenerativeModel(GEMINI_MODEL)
        print(f"[OK] Gemini configured with model: {GEMINI_MODEL}")
    except Exception as gemini_setup_error:
        gemini_client = None
        print(f"[WARNING] Gemini setup failed: {gemini_setup_error}")
else:
    print("[INFO] GEMINI_API_KEY not set. Gemini features will use fallback behavior.")

@app.route("/", methods=["GET"])
def root():
    return jsonify({
        "status": "ok",
        "message": "ASL backend is running",
        "model_loaded": model is not None,
        "predictor_available": model is not None or ENABLE_HEURISTIC_FALLBACK,
        "fallback_enabled": model is None and ENABLE_HEURISTIC_FALLBACK
    })

# Load ML model with local + deployment-friendly path resolution
SCRIPT_DIR = BACKEND_DIR
MODEL_CANDIDATES = [
    os.getenv('ASL_MODEL_PATH', '').strip(),
    os.path.join(SCRIPT_DIR, '..', '..', 'data', 'asl_model.pkl'),
    os.path.join(SCRIPT_DIR, 'asl_model.pkl'),
]
MODEL_CANDIDATES = [os.path.normpath(path) for path in MODEL_CANDIDATES if path]
MODEL_PATH = next(
    (path for path in MODEL_CANDIDATES if os.path.exists(path)),
    MODEL_CANDIDATES[0] if MODEL_CANDIDATES else 'asl_model.pkl'
)
MODEL_LOAD_ERROR = None


def model_setup_hint():
    return (
        'ASL model is missing or failed to load. Train it with '
        '`python inference_classifier.py`, copy `data/asl_model.pkl` to '
        '`asl-web-app/backend/asl_model.pkl`, or set ASL_MODEL_PATH to the trained model file.'
    )

print(f"[INFO] Model search paths: {MODEL_CANDIDATES}")
model = None
try:
    if os.path.exists(MODEL_PATH):
        with open(MODEL_PATH, 'rb') as f:
            model = pickle.load(f)
        print(f"[OK] Model loaded successfully from: {MODEL_PATH}")
    else:
        MODEL_LOAD_ERROR = f"Model not found. Checked: {MODEL_CANDIDATES}"
        print(f"[WARNING] {MODEL_LOAD_ERROR}")
        print(f"[INFO] {model_setup_hint()}")
except Exception as e:
    MODEL_LOAD_ERROR = f"Failed to load model: {e}"
    print(f"[ERROR] {MODEL_LOAD_ERROR}")
    print(f"[INFO] {model_setup_hint()}")
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
MODEL_FEATURE_MODE = getattr(model, 'asl_feature_mode', 'raw_xy_v1') if model is not None else (
    'heuristic_demo_v1' if ENABLE_HEURISTIC_FALLBACK else 'unavailable'
)
history_lock = threading.Lock()
cache_lock = threading.Lock()
session_lock = threading.Lock()
prediction_cache = OrderedDict()
session_prediction_state = OrderedDict()

# Word prediction dictionary and common assistive phrases
COMMON_WORDS = [
    'hello', 'hi', 'help', 'need', 'water', 'medicine', 'please', 'sorry',
    'thank', 'you', 'yes', 'no', 'good', 'morning', 'afternoon', 'evening',
    'night', 'how', 'are', 'what', 'when', 'where', 'why', 'who', 'want',
    'food', 'bathroom', 'family', 'call', 'pain', 'doctor', 'emergency', 'fine'
]
COMMON_PHRASES = [
    'Hello', 'How are you?', 'I need help', 'Please wait', 'Thank you',
    'Yes, please', 'No, thank you', 'I need water', 'I need medicine',
    'Call my family', 'I am fine', 'I am in pain', 'Please call a doctor'
]
PHRASE_HINTS = {
    'hello': ['Hello', 'Hello, how are you?'],
    'help': ['I need help', 'Please help me'],
    'please': ['Please wait', 'Please help me'],
    'thank': ['Thank you', 'Thank you very much'],
    'need': ['I need help', 'I need water', 'I need medicine'],
    'pain': ['I am in pain', 'Please call a doctor'],
    'call': ['Call my family', 'Please call a doctor'],
}

def _unique_preserve(items):
    seen = set()
    ordered = []
    for item in items:
        normalized = str(item).strip().lower()
        if normalized and normalized not in seen:
            seen.add(normalized)
            ordered.append(str(item).strip())
    return ordered

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
    """Return context-aware word and phrase suggestions for the current text buffer."""
    normalized_text = ' '.join(str(current_text or '').strip().split())
    lowered_text = normalized_text.lower()
    tokens = lowered_text.split()
    current_word = tokens[-1] if tokens else ''

    word_candidates = []
    phrase_candidates = []

    if current_word:
        word_candidates.extend(word for word in COMMON_WORDS if word.startswith(current_word))
        word_candidates.extend(word for word in COMMON_WORDS if current_word in word and not word.startswith(current_word))
    else:
        word_candidates.extend(COMMON_WORDS)

    if lowered_text:
        phrase_candidates.extend(phrase for phrase in COMMON_PHRASES if phrase.lower().startswith(lowered_text))

    if current_word:
        phrase_candidates.extend(phrase for phrase in COMMON_PHRASES if any(part.startswith(current_word) for part in phrase.lower().split()))
        phrase_candidates.extend(PHRASE_HINTS.get(current_word, []))

    if len(tokens) >= 2:
        context_key = ' '.join(tokens[-2:])
        phrase_candidates.extend(PHRASE_HINTS.get(context_key, []))

    if tokens:
        phrase_candidates.extend(PHRASE_HINTS.get(tokens[0], []))

    return {
        'words': _unique_preserve(word_candidates)[:5] or COMMON_WORDS[:5],
        'phrases': _unique_preserve(phrase_candidates + COMMON_PHRASES)[:6],
        'current_word': current_word,
        'text': normalized_text,
    }

def _prepare_features(landmarks):
    arr = np.asarray(landmarks, dtype=np.float32).flatten()
    if arr.size == 0:
        raise ValueError('No landmarks provided')

    features = prepare_model_features(model, arr)
    if MODEL_FEATURES and features.shape[1] != MODEL_FEATURES:
        raise ValueError(f'Expected {MODEL_FEATURES} model features, received {features.shape[1]}')
    return features

def _cache_key(landmarks):
    arr = np.asarray(landmarks, dtype=np.float32).flatten()
    if arr.size == 0:
        return 'empty'

    rounded = np.round(arr, 4).astype(np.float32, copy=False)
    digest = hashlib.blake2b(rounded.tobytes(), digest_size=16).hexdigest()
    return f'{arr.size}:{digest}'


def _normalize_session_id(session_id):
    if session_id is None:
        return None
    value = str(session_id).strip()
    return value[:80] if value else None


def _apply_temporal_consensus(session_id, result):
    payload = dict(result)
    payload.setdefault('temporal_hits', 0)
    payload.setdefault('temporal_ratio', 0.0)
    payload.setdefault('temporal_window', 0)
    payload.setdefault('stable_prediction', '')
    payload.setdefault('stable_confidence', 0.0)
    payload.setdefault('temporal_accepted', False)

    normalized_session_id = _normalize_session_id(session_id)
    if not normalized_session_id:
        payload['stable_prediction'] = payload.get('prediction', '')
        payload['stable_confidence'] = float(payload.get('confidence', 0.0))
        payload['temporal_accepted'] = bool(payload.get('prediction'))
        return payload

    with session_lock:
        state = session_prediction_state.get(normalized_session_id)
        if state is None:
            state = {
                'labels': deque(maxlen=TEMPORAL_WINDOW_SIZE),
                'confidences': deque(maxlen=TEMPORAL_WINDOW_SIZE),
                'misses': 0,
            }
            session_prediction_state[normalized_session_id] = state
        else:
            session_prediction_state.move_to_end(normalized_session_id)

        while len(session_prediction_state) > SESSION_STATE_LIMIT:
            session_prediction_state.popitem(last=False)

        if payload.get('accepted') and payload.get('raw_prediction'):
            state['labels'].append(payload['raw_prediction'])
            state['confidences'].append(float(payload.get('confidence', 0.0)))
            state['misses'] = 0
        else:
            state['misses'] += 1
            if state['misses'] >= 2:
                state['labels'].clear()
                state['confidences'].clear()

        labels = list(state['labels'])
        if labels:
            consensus_label, hits = Counter(labels).most_common(1)[0]
            ratio = hits / len(labels)
            matched_confidences = [
                conf for label, conf in zip(state['labels'], state['confidences'])
                if label == consensus_label
            ]
            stable_confidence = float(np.mean(matched_confidences)) if matched_confidences else 0.0
            temporal_accepted = (
                hits >= TEMPORAL_MIN_HITS
                and ratio >= TEMPORAL_MIN_RATIO
                and stable_confidence >= MIN_PREDICTION_CONFIDENCE
            )
        else:
            consensus_label = ''
            hits = 0
            ratio = 0.0
            stable_confidence = 0.0
            temporal_accepted = False

    payload['temporal_hits'] = hits
    payload['temporal_ratio'] = float(ratio)
    payload['temporal_window'] = len(labels)
    payload['stable_prediction'] = consensus_label if temporal_accepted else ''
    payload['stable_confidence'] = stable_confidence if temporal_accepted else 0.0
    payload['temporal_accepted'] = temporal_accepted
    payload['prediction'] = payload['stable_prediction']
    return payload


def _distance(point_a, point_b):
    return float(np.linalg.norm(point_a - point_b))


def _finger_states(coords):
    fingers = {
        'index': (8, 6, 5),
        'middle': (12, 10, 9),
        'ring': (16, 14, 13),
        'pinky': (20, 18, 17),
    }
    states = {}
    for name, (tip_index, pip_index, mcp_index) in fingers.items():
        tip = coords[tip_index]
        pip = coords[pip_index]
        mcp = coords[mcp_index]
        states[name] = {
            'extended': tip[1] < pip[1] - 0.035 and tip[1] < mcp[1] - 0.07,
            'curled': tip[1] > pip[1] - 0.015,
            'tip': tip,
        }

    thumb_tip = coords[4]
    thumb_ip = coords[3]
    thumb_mcp = coords[2]
    states['thumb'] = {
        'extended': abs(thumb_tip[0] - thumb_mcp[0]) > 0.18 and _distance(thumb_tip, coords[9]) > 0.24,
        'curled': _distance(thumb_tip, coords[9]) < 0.28 or abs(thumb_tip[0] - thumb_ip[0]) < 0.08,
        'tip': thumb_tip,
    }
    return states


def _ranked_heuristic_predictions(coords):
    states = _finger_states(coords)
    extended = {name for name, state in states.items() if state['extended']}
    thumb_index_distance = _distance(coords[4], coords[8])
    thumb_middle_distance = _distance(coords[4], coords[12])
    fingertip_distances = [_distance(coords[4], coords[index]) for index in (8, 12, 16, 20)]
    bbox_width = float(coords[:, 0].max() - coords[:, 0].min())
    bbox_height = float(coords[:, 1].max() - coords[:, 1].min())
    aspect_ratio = bbox_width / bbox_height if bbox_height > 1e-6 else 0.0

    candidates = []
    add = candidates.append
    four_fingers = {'index', 'middle', 'ring', 'pinky'}.issubset(extended)

    if four_fingers and 'thumb' not in extended:
        add(('B', 0.82, 'four fingers up, thumb folded'))
    if {'index', 'middle', 'ring'}.issubset(extended) and 'pinky' not in extended:
        add(('W', 0.84, 'three raised fingers'))
    if {'index', 'middle'}.issubset(extended) and not {'ring', 'pinky'} & extended:
        add(('V', 0.82, 'two raised fingers'))
    if extended == {'index'} and thumb_index_distance > 0.22:
        add(('D', 0.78, 'single raised index'))
    if {'thumb', 'index'}.issubset(extended) and not {'middle', 'ring', 'pinky'} & extended:
        add(('L', 0.84, 'thumb and index angle'))
    if {'thumb', 'pinky'}.issubset(extended) and not {'index', 'middle', 'ring'} & extended:
        add(('Y', 0.84, 'thumb and pinky extended'))
    if extended == {'pinky'}:
        add(('I', 0.8, 'pinky extended'))
    if thumb_index_distance < 0.12 and {'middle', 'ring', 'pinky'}.issubset(extended):
        add(('F', 0.83, 'thumb-index circle with three fingers up'))
    if max(fingertip_distances) < 0.28:
        add(('O', 0.78, 'rounded closed fingertips'))
    if not extended and states['thumb']['extended']:
        add(('A', 0.76, 'closed fist with visible thumb'))
    if not extended and not states['thumb']['extended']:
        add(('S', 0.72, 'closed fist'))
    if not four_fingers and 0.65 <= aspect_ratio <= 1.35 and bbox_width > 0.32 and bbox_height > 0.32:
        add(('C', 0.7, 'curved open hand silhouette'))
    if extended == {'index', 'middle', 'pinky'}:
        add(('K', 0.68, 'split raised fingers'))
    if thumb_middle_distance < 0.18 and extended == {'index'}:
        add(('T', 0.64, 'thumb tucked near fingers'))

    if not candidates:
        if four_fingers:
            add(('B', 0.62, 'open hand fallback'))
        elif 'index' in extended:
            add(('D', 0.6, 'pointing fallback'))
        else:
            add(('A', 0.58, 'closed-hand fallback'))

    ranked = []
    seen = set()
    for label, confidence, reason in sorted(candidates, key=lambda item: item[1], reverse=True):
        if label in seen:
            continue
        seen.add(label)
        ranked.append({'label': label, 'confidence': float(confidence), 'reason': reason})

    for label in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ':
        if len(ranked) >= 3:
            break
        if label not in seen:
            ranked.append({'label': label, 'confidence': 0.25, 'reason': 'low-confidence fallback'})
            seen.add(label)

    return ranked[:3]


def predict_landmarks_heuristic(landmarks, session_id=None):
    """Fallback ASL demo predictor used only when no trained model is available."""
    arr = np.asarray(landmarks, dtype=np.float32).flatten()
    if arr.size == 0:
        raise ValueError('No landmarks provided')

    if arr.size >= 63 and arr.size % 3 == 0:
        coords = arr.reshape(-1, 3)[:21, :2]
    elif arr.size >= 42:
        coords = arr[:42].reshape(21, 2)
    else:
        raise ValueError(f'Expected at least 42 landmark values, received {arr.size}')

    ranked = _ranked_heuristic_predictions(coords)
    best = ranked[0]
    second_confidence = ranked[1]['confidence'] if len(ranked) > 1 else 0.0
    confidence = float(best['confidence'])
    accepted = confidence >= 0.55
    raw_result = {
        'prediction': best['label'] if accepted else '',
        'raw_prediction': best['label'],
        'confidence': confidence,
        'confidence_margin': float(confidence - second_confidence),
        'accepted': accepted,
        'top_predictions': [
            {'label': item['label'], 'confidence': item['confidence']}
            for item in ranked
        ],
        'timestamp': datetime.now().isoformat(),
        'cached': False,
        'fallback': True,
        'fallback_mode': 'heuristic_demo_v1',
        'fallback_reason': best.get('reason', 'heuristic match'),
    }
    return _apply_temporal_consensus(session_id, raw_result)


def predict_landmarks_cached(landmarks, session_id=None):
    """Run a fast cached prediction for one landmark vector."""
    if model is None:
        if ENABLE_HEURISTIC_FALLBACK:
            return predict_landmarks_heuristic(landmarks, session_id)
        raise RuntimeError('Model not loaded')

    cache_key = _cache_key(landmarks)
    with cache_lock:
        cached = prediction_cache.get(cache_key)
        if cached is not None:
            prediction_cache.move_to_end(cache_key)
            return _apply_temporal_consensus(session_id, {**cached, 'cached': True})

    features = _prepare_features(landmarks)
    try:
        future = prediction_executor.submit(model.predict_proba, features)
        probabilities = future.result(timeout=PREDICT_TIMEOUT)[0]
    except concurrent.futures.TimeoutError:
        raise RuntimeError('Model prediction timed out')
    except Exception as e:
        raise RuntimeError(f'Model prediction failed: {e}')
    best_index = int(np.argmax(probabilities))
    sorted_indices = np.argsort(probabilities)[::-1]
    best_confidence = float(probabilities[best_index])
    second_confidence = float(probabilities[sorted_indices[1]]) if len(sorted_indices) > 1 else 0.0
    confidence_margin = best_confidence - second_confidence
    accepted = best_confidence >= MIN_PREDICTION_CONFIDENCE and confidence_margin >= MIN_PREDICTION_MARGIN

    raw_result = {
        'prediction': str(model.classes_[best_index]) if accepted else '',
        'raw_prediction': str(model.classes_[best_index]),
        'confidence': best_confidence,
        'confidence_margin': float(confidence_margin),
        'accepted': accepted,
        'top_predictions': top_k_predictions(probabilities, model.classes_, k=3),
        'timestamp': datetime.now().isoformat(),
        'cached': False
    }

    with cache_lock:
        prediction_cache[cache_key] = raw_result
        prediction_cache.move_to_end(cache_key)
        while len(prediction_cache) > CACHE_LIMIT:
            prediction_cache.popitem(last=False)

    return _apply_temporal_consensus(session_id, raw_result)

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    predictor_available = model is not None or ENABLE_HEURISTIC_FALLBACK
    return jsonify({
        'status': 'healthy' if model is not None else ('demo' if ENABLE_HEURISTIC_FALLBACK else 'degraded'),
        'model_loaded': model is not None,
        'predictor_available': predictor_available,
        'fallback_enabled': model is None and ENABLE_HEURISTIC_FALLBACK,
        'fallback_mode': 'heuristic_demo_v1' if model is None and ENABLE_HEURISTIC_FALLBACK else None,
        'model_path': MODEL_PATH,
        'model_candidates': MODEL_CANDIDATES,
        'model_error': MODEL_LOAD_ERROR,
        'setup_hint': None if model is not None else (
            'Demo fallback is active. Add a trained asl_model.pkl for full A-Z ML accuracy.'
            if ENABLE_HEURISTIC_FALLBACK else model_setup_hint()
        ),
        'feature_count': MODEL_FEATURES,
        'feature_mode': MODEL_FEATURE_MODE,
        'min_confidence': MIN_PREDICTION_CONFIDENCE,
        'min_margin': MIN_PREDICTION_MARGIN,
        'temporal_window_size': TEMPORAL_WINDOW_SIZE,
        'temporal_min_hits': TEMPORAL_MIN_HITS,
        'temporal_min_ratio': TEMPORAL_MIN_RATIO,
        'cache_size': len(prediction_cache),
        'active_sessions': len(session_prediction_state),
        'timestamp': datetime.now().isoformat()
    })

@app.route('/predict', methods=['POST'])
def predict():
    """Predict one ASL sign from landmarks."""
    try:
        data = request.get_json(silent=True) or {}
        if model is None and not ENABLE_HEURISTIC_FALLBACK:
            return jsonify({
                'error': 'Model not loaded',
                'model_path': MODEL_PATH,
                'model_candidates': MODEL_CANDIDATES,
                'model_error': MODEL_LOAD_ERROR,
                'setup_hint': model_setup_hint()
            }), 503
        landmarks = data.get('landmarks')
        if not isinstance(landmarks, list) or not landmarks:
            return jsonify({'error': 'Invalid or missing landmarks'}), 400

        session_id = data.get('sessionId') or request.headers.get('X-Session-Id') or request.remote_addr
        result = predict_landmarks_cached(landmarks, session_id)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/predict/batch', methods=['POST'])
def predict_batch():
    """Predict multiple landmark sets in one request."""
    try:
        if model is None and not ENABLE_HEURISTIC_FALLBACK:
            return jsonify({
                'error': 'Model not loaded',
                'model_path': MODEL_PATH,
                'model_candidates': MODEL_CANDIDATES,
                'model_error': MODEL_LOAD_ERROR,
                'setup_hint': model_setup_hint()
            }), 503
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

def _gemini_json_prompt(prompt, fallback_error='Gemini request failed'):
    if gemini_client is None:
        raise RuntimeError('Gemini is not configured on backend')

    response = gemini_client.generate_content(prompt)
    text = getattr(response, 'text', '') or ''
    cleaned = text.strip().replace('```json', '').replace('```', '').strip()
    if not cleaned:
        raise RuntimeError(fallback_error)
    return cleaned

@app.route('/gemini/correct', methods=['POST'])
def gemini_correct():
    try:
        data = request.get_json(silent=True) or {}
        text = str(data.get('text', '')).strip().lower()
        if not text:
            return jsonify({'corrected': ''})

        prompt = (
            "Fix this possibly noisy ASL letter sequence into the most likely English word. "
            "Return JSON only with one key named corrected. "
            f"Input: '{text}'"
        )
        raw = _gemini_json_prompt(prompt, 'Gemini correction failed')
        import json
        parsed = json.loads(raw)
        corrected = str(parsed.get('corrected', text)).strip().lower()
        return jsonify({'corrected': corrected or text})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/gemini/suggestions', methods=['POST'])
def gemini_suggestions():
    try:
        data = request.get_json(silent=True) or {}
        text = str(data.get('text', '')).strip()
        if not text:
            return jsonify({'suggestions': []})

        prompt = (
            "Return JSON only as an array of 3 likely English words based on this ASL-built text: "
            f"'{text}'"
        )
        raw = _gemini_json_prompt(prompt, 'Gemini suggestions failed')
        import json
        parsed = json.loads(raw)
        suggestions = parsed if isinstance(parsed, list) else []
        suggestions = [str(item).strip() for item in suggestions if str(item).strip()][:3]
        return jsonify({'suggestions': suggestions})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/gemini/translate-urdu', methods=['POST'])
def gemini_translate_urdu():
    try:
        data = request.get_json(silent=True) or {}
        text = str(data.get('text', '')).strip()
        if not text:
            return jsonify({'translation': ''})

        prompt = f"Translate this English sentence to Roman Urdu only: '{text}'"
        raw = _gemini_json_prompt(prompt, 'Gemini translation failed')
        translation = raw.replace('"', '').replace("'", '').strip()
        return jsonify({'translation': translation})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/predict-words', methods=['POST'])
def predict_words_endpoint():
    """Get word predictions based on current text"""
    try:
        data = request.json
        current_text = data.get('text', '')
        suggestions = predict_words(current_text)

        return jsonify({
            'predictions': suggestions['words'],
            'phrases': suggestions['phrases'],
            'current_word': suggestions['current_word'],
            'normalized_text': suggestions['text'],
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

        result = predict_landmarks_cached(landmarks, getattr(request, 'sid', None))
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
