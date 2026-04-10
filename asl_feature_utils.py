"""
Shared ASL landmark normalization and feature engineering helpers.

These utilities keep the training, desktop inference, and web backend using the
same feature representation so accuracy and stability improvements stay aligned.
"""

from __future__ import annotations

import numpy as np

FEATURE_MODE_ENGINEERED = 'engineered_xy_v2'

_DISTANCE_PAIRS = [
    (4, 8), (4, 12), (4, 16), (4, 20),
    (8, 12), (8, 16), (8, 20),
    (12, 16), (12, 20),
    (16, 20),
    (0, 8), (0, 12), (0, 16), (0, 20),
    (5, 17),
]

_ANGLE_TRIPLETS = [
    (1, 2, 4), (0, 2, 4),
    (5, 6, 8), (0, 6, 8),
    (9, 10, 12), (0, 10, 12),
    (13, 14, 16), (0, 14, 16),
    (17, 18, 20), (0, 18, 20),
]


def _point_xy(item):
    if hasattr(item, 'x') and hasattr(item, 'y'):
        return float(item.x), float(item.y)
    if isinstance(item, (list, tuple, np.ndarray)) and len(item) >= 2:
        return float(item[0]), float(item[1])
    raise TypeError(f'Unsupported landmark point format: {type(item)!r}')


def landmarks_to_xy_array(hand_landmarks) -> np.ndarray:
    """Convert MediaPipe or flat landmark input into a `(21, 2)` float array."""
    if hasattr(hand_landmarks, 'landmark'):
        iterable = hand_landmarks.landmark
    else:
        iterable = hand_landmarks

    coords = np.asarray([_point_xy(item) for item in iterable], dtype=np.float32)
    if coords.shape[0] < 21:
        raise ValueError(f'Expected at least 21 landmarks, received {coords.shape[0]}')
    return coords[:21, :2]


def normalize_landmarks(hand_landmarks, handedness=None) -> np.ndarray:
    """Normalize landmarks to wrist origin, mirror left hand, and scale to hand size."""
    coords = landmarks_to_xy_array(hand_landmarks)
    wrist = coords[0]
    normalized = coords - wrist

    if handedness and str(handedness).lower().startswith('left'):
        normalized[:, 0] *= -1

    x_span = float(normalized[:, 0].max() - normalized[:, 0].min())
    y_span = float(normalized[:, 1].max() - normalized[:, 1].min())
    scale = max(x_span, y_span)

    if scale > 0:
        normalized = normalized / scale

    return normalized.astype(np.float32).flatten()


def coerce_landmark_vector(landmarks) -> np.ndarray:
    """Coerce a flattened landmark vector to normalized XY shape `(42,)`."""
    arr = np.asarray(landmarks, dtype=np.float32).flatten()
    if arr.size == 42:
        return arr
    if arr.size >= 63 and arr.size % 3 == 0:
        return arr.reshape(-1, 3)[:21, :2].astype(np.float32).flatten()
    if arr.size > 42:
        return arr[:42].astype(np.float32)
    raise ValueError(f'Expected 42 normalized XY values or 63 XYZ values, received {arr.size}')


def _safe_angle(a: np.ndarray, b: np.ndarray, c: np.ndarray) -> float:
    ab = a - b
    cb = c - b
    denom = np.linalg.norm(ab) * np.linalg.norm(cb)
    if denom <= 1e-6:
        return 0.0
    cosine = float(np.clip(np.dot(ab, cb) / denom, -1.0, 1.0))
    return float(np.arccos(cosine) / np.pi)


def extract_engineered_features(landmarks) -> np.ndarray:
    """Create a richer feature vector from normalized XY hand landmarks."""
    base = coerce_landmark_vector(landmarks)
    coords = base.reshape(21, 2)

    distances = np.asarray([
        np.linalg.norm(coords[i] - coords[j]) for i, j in _DISTANCE_PAIRS
    ], dtype=np.float32)

    angles = np.asarray([
        _safe_angle(coords[a], coords[b], coords[c]) for a, b, c in _ANGLE_TRIPLETS
    ], dtype=np.float32)

    bbox_width = float(coords[:, 0].max() - coords[:, 0].min())
    bbox_height = float(coords[:, 1].max() - coords[:, 1].min())
    aspect_ratio = bbox_width / bbox_height if bbox_height > 1e-6 else 0.0
    fingertip_y = coords[[8, 12, 16, 20], 1] - coords[0, 1]
    fingertip_x = coords[[4, 8, 12, 16, 20], 0] - coords[0, 0]

    shape_features = np.asarray([
        bbox_width,
        bbox_height,
        aspect_ratio,
        float(np.mean(np.abs(fingertip_y))),
        float(np.std(fingertip_y)),
        float(np.mean(np.abs(fingertip_x))),
    ], dtype=np.float32)

    features = np.concatenate([base, distances, angles, shape_features, fingertip_y, fingertip_x])
    return np.nan_to_num(features.astype(np.float32), nan=0.0, posinf=0.0, neginf=0.0)


def prepare_model_features(model, landmarks) -> np.ndarray:
    """Match raw landmarks to the feature representation expected by the model."""
    base = coerce_landmark_vector(landmarks)
    engineered = extract_engineered_features(base)
    expected = getattr(model, 'n_features_in_', None)
    feature_mode = getattr(model, 'asl_feature_mode', None)

    if feature_mode == FEATURE_MODE_ENGINEERED:
        return engineered.reshape(1, -1)
    if expected == engineered.size and expected != base.size:
        return engineered.reshape(1, -1)
    if expected is None or expected == base.size:
        return base.reshape(1, -1)

    raise ValueError(
        f'Model expects {expected} features, but only {base.size} raw or {engineered.size} engineered features are available.'
    )


def top_k_predictions(probabilities, classes, k: int = 3):
    """Return the top-k class predictions as JSON-friendly dictionaries."""
    probs = np.asarray(probabilities, dtype=np.float32)
    order = np.argsort(probs)[::-1][:k]
    return [
        {'label': str(classes[index]), 'confidence': float(probs[index])}
        for index in order
    ]
