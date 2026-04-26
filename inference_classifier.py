"""
ASL Alphabet Real-Time Classifier
This script trains a classifier on collected hand landmark data and performs real-time predictions.

How to use:
1. First, collect data using data_collector.py
2. Run this script: python inference_classifier.py
3. The script will:
   - Load the dataset from data/asl_dataset.csv
   - Train a Random Forest classifier
   - Display model accuracy
   - Open webcam for real-time ASL letter prediction
4. Press 'q' to quit

Training Process:
- The script uses 80% of data for training and 20% for testing
- A Random Forest classifier is used (you can swap with SVM if needed)
- The model is evaluated and accuracy is displayed before inference starts
"""

import cv2
import mediapipe as mp
import numpy as np
import pandas as pd
from sklearn.ensemble import ExtraTreesClassifier, RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC
import pickle
import os
from collections import Counter, deque

from asl_feature_utils import (
    FEATURE_MODE_ENGINEERED,
    extract_engineered_features,
    normalize_landmarks,
    prepare_model_features,
)

TRAINING_WORKERS = int(os.getenv('ASL_TRAINING_WORKERS', '1'))

# Initialize MediaPipe Hands using the tasks API
BaseOptions = mp.tasks.BaseOptions
HandLandmarker = mp.tasks.vision.HandLandmarker
HandLandmarkerOptions = mp.tasks.vision.HandLandmarkerOptions
VisionRunningMode = mp.tasks.vision.RunningMode

# Hand connections for drawing
HAND_CONNECTIONS = frozenset([
    (0, 1), (1, 2), (2, 3), (3, 4),  # Thumb
    (0, 5), (5, 6), (6, 7), (7, 8),  # Index
    (0, 9), (9, 10), (10, 11), (11, 12),  # Middle
    (0, 13), (13, 14), (14, 15), (15, 16),  # Ring
    (0, 17), (17, 18), (18, 19), (19, 20),  # Pinky
    (5, 9), (9, 13), (13, 17)  # Palm
])


def rebalance_training_data(X, y, random_state=42):
    """Lightly oversample underrepresented classes with small feature jitter."""
    rng = np.random.default_rng(random_state)
    counts = Counter(y)
    target_count = max(40, int(np.median(list(counts.values()))))

    x_parts = [X]
    y_parts = [y]

    for label, count in counts.items():
        if count >= target_count:
            continue
        class_samples = X[y == label]
        needed = target_count - count
        indices = rng.choice(len(class_samples), size=needed, replace=True)
        synthetic = class_samples[indices] + rng.normal(0, 0.01, size=(needed, X.shape[1]))
        x_parts.append(np.clip(synthetic, -2.5, 2.5))
        y_parts.append(np.array([label] * needed, dtype=object))

    return np.vstack(x_parts), np.concatenate(y_parts)

def print_top_confusions(y_true, y_pred, max_rows=8):
    """Print the most frequent label confusions to guide additional data collection."""
    confusion_counts = Counter()
    for truth, pred in zip(y_true, y_pred):
        if truth != pred:
            confusion_counts[(truth, pred)] += 1

    if not confusion_counts:
        print("[OK] No misclassifications on the validation split.")
        return

    print("\nTop confusion pairs:")
    for (truth, pred), count in confusion_counts.most_common(max_rows):
        print(f"  - {truth} -> {pred}: {count} samples")
def load_and_train_model(dataset_path='data/asl_dataset.csv'):
    """
    Load dataset and train a classifier
    
    Args:
        dataset_path: Path to the CSV file containing hand landmark data
        
    Returns:
        Trained classifier model
    """
    print("\n" + "="*60)
    print("Training ASL Classifier")
    print("="*60)
    
    # Check if dataset exists
    if not os.path.exists(dataset_path):
        print(f"\n[X] Error: Dataset not found at {dataset_path}")
        print("Please run data_collector.py first to collect training data.")
        return None
    
    # Load dataset
    print(f"\nLoading dataset from {dataset_path}...")
    df = pd.read_csv(dataset_path)
    
    print(f"[OK] Loaded {len(df)} samples")
    print(f"[OK] Classes found: {sorted(df['label'].unique())}")
    print(f"[OK] Samples per class:\n{df['label'].value_counts().sort_index()}")
    
    # Check if we have enough data
    if len(df) < 10:
        print("\n[!] Warning: Very few samples! Collect more data for better accuracy.")
    
    # Prepare features (X) and labels (y)
    raw_landmarks = df.drop('label', axis=1).astype(np.float32).values
    X = np.vstack([extract_engineered_features(row) for row in raw_landmarks])
    y = df['label'].astype(str).to_numpy()

    print(f"[OK] Engineered feature vector size: {X.shape[1]}")
    
    # Split data into training and testing sets
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    print(f"\nTraining set: {len(X_train)} samples")
    print(f"Testing set: {len(X_test)} samples")
    
    # Rebalance weak classes to improve minority-letter recognition
    X_train_balanced, y_train_balanced = rebalance_training_data(X_train, y_train)
    print(f"\nBalanced training set: {len(X_train_balanced)} samples")

    candidate_models = {
        'RandomForest': RandomForestClassifier(
            n_estimators=250,
            max_depth=None,
            min_samples_leaf=1,
            class_weight='balanced_subsample',
            random_state=42,
            n_jobs=TRAINING_WORKERS
        ),
        'ExtraTrees': ExtraTreesClassifier(
            n_estimators=300,
            max_depth=None,
            class_weight='balanced',
            random_state=42,
            n_jobs=TRAINING_WORKERS
        ),
        'SVC': Pipeline([
            ('scaler', StandardScaler()),
            ('svc', SVC(C=8, kernel='rbf', gamma='scale', probability=True, class_weight='balanced', random_state=42))
        ])
    }

    best_name = None
    best_model = None
    best_accuracy = -1.0

    for name, candidate in candidate_models.items():
        print(f"\nTraining {name}...")
        candidate.fit(X_train_balanced, y_train_balanced)
        y_pred = candidate.predict(X_test)
        accuracy = accuracy_score(y_test, y_pred)
        print(f"[OK] {name} accuracy: {accuracy * 100:.2f}%")

        if accuracy > best_accuracy:
            best_accuracy = accuracy
            best_name = name
            best_model = candidate

    model = best_model
    y_pred = model.predict(X_test)

    print(f"\n{'='*60}")
    print(f"Best Model: {best_name}")
    print(f"Model Accuracy: {best_accuracy * 100:.2f}%")
    print(f"{'='*60}")

    print("\nDetailed Classification Report:")
    print(classification_report(y_test, y_pred, zero_division=0))
    print_top_confusions(y_test, y_pred)

    model.asl_feature_mode = FEATURE_MODE_ENGINEERED
    model.asl_landmark_input_size = 42
    model.asl_engineered_feature_count = int(X.shape[1])
    model.asl_best_model_name = best_name

    model_path = 'data/asl_model.pkl'
    with open(model_path, 'wb') as f:
        pickle.dump(model, f)
    print(f"[OK] Model saved to {model_path}")

    return model

def run_inference(model):
    """
    Run real-time ASL letter prediction using webcam
    
    Args:
        model: Trained classifier model
    """
    if model is None:
        return
    
    # --- Optimized Real-Time Inference ---
    import threading
    from queue import Queue

    # Frame skipping: process every Nth frame
    FRAME_SKIP = 1  # Process every 2nd frame for better responsiveness
    # Prediction smoothing buffer length
    PREDICTION_BUFFER_LEN = 7
    # Confidence threshold
    CONFIDENCE_THRESHOLD = 0.80

    # Threaded frame capture
    def capture_frames(queue, cap):
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            if queue.qsize() < 2:
                queue.put(frame)

    options = HandLandmarkerOptions(
        base_options=BaseOptions(model_asset_path='hand_landmarker.task'),
        running_mode=VisionRunningMode.VIDEO,
        num_hands=1,
        min_hand_detection_confidence=0.7,
        min_hand_presence_confidence=0.5,
        min_tracking_confidence=0.5
    )

    cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
    if not cap.isOpened():
        print("Error: Could not open webcam. Trying alternate method...")
        cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            print("Error: Webcam access failed. Please check:")
            print("  1. Webcam is connected")
            print("  2. No other application is using the webcam")
            print("  3. Webcam permissions are granted")
            return
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    cap.set(cv2.CAP_PROP_FPS, 30)

    print("\n" + "="*60)
    print("Real-Time ASL Alphabet Recognition (Optimized)")
    print("="*60)
    print("\nInstructions:")
    print("  - Show your hand to the camera")
    print("  - Make ASL alphabet signs")
    print("  - The predicted letter will be displayed on screen")
    print("  - Press 'q' to quit")
    print("="*60 + "\n")

    frame_queue = Queue()
    capture_thread = threading.Thread(target=capture_frames, args=(frame_queue, cap), daemon=True)
    capture_thread.start()

    prediction_buffer = deque(maxlen=PREDICTION_BUFFER_LEN)
    frame_count = 0

    with HandLandmarker.create_from_options(options) as landmarker:
        while True:
            if frame_queue.empty():
                continue
            frame = frame_queue.get()
            frame_count += 1
            if frame_count % (FRAME_SKIP + 1) != 0:
                continue  # Skip this frame for performance

            frame = cv2.flip(frame, 1)
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
            timestamp_ms = frame_count
            detection_result = landmarker.detect_for_video(mp_image, timestamp_ms)

            prediction_text = "No hand detected"
            prediction_color = (0, 0, 255)
            confidence = 0.0

            if detection_result.hand_landmarks:
                hand_landmarks = detection_result.hand_landmarks[0]
                h, w, _ = frame.shape
                for i, lm in enumerate(hand_landmarks):
                    cx, cy = int(lm.x * w), int(lm.y * h)
                    cv2.circle(frame, (cx, cy), 5, (0, 255, 0), -1)
                for connection in HAND_CONNECTIONS:
                    start_idx, end_idx = connection
                    start_lm = hand_landmarks[start_idx]
                    end_lm = hand_landmarks[end_idx]
                    start_point = (int(start_lm.x * w), int(start_lm.y * h))
                    end_point = (int(end_lm.x * w), int(end_lm.y * h))
                    cv2.line(frame, start_point, end_point, (255, 0, 0), 2)
                handedness = None
                if getattr(detection_result, 'handedness', None):
                    handedness = detection_result.handedness[0][0].category_name
                normalized_landmarks = normalize_landmarks(hand_landmarks, handedness)
                features = prepare_model_features(model, normalized_landmarks)
                pred_probs = model.predict_proba(features)[0]
                pred_idx = np.argmax(pred_probs)
                confidence = pred_probs[pred_idx]
                prediction = model.classes_[pred_idx]
                # Only accept predictions above threshold
                if confidence > CONFIDENCE_THRESHOLD:
                    prediction_buffer.append(prediction)
                # Get most common prediction from buffer
                if len(prediction_buffer) > 0:
                    most_common = Counter(prediction_buffer).most_common(1)[0][0]
                    prediction_text = f"Prediction: {most_common}"
                    prediction_color = (0, 255, 0)
                confidence_text = f"Confidence: {confidence * 100:.1f}%"
                cv2.putText(frame, confidence_text, (10, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

            overlay = frame.copy()
            cv2.rectangle(overlay, (5, 5), (400, 100), (0, 0, 0), -1)
            cv2.addWeighted(overlay, 0.3, frame, 0.7, 0, frame)
            cv2.putText(frame, prediction_text, (10, 40), cv2.FONT_HERSHEY_SIMPLEX, 1.2, prediction_color, 3)
            cv2.putText(frame, "Press 'q' to quit", (10, frame.shape[0] - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
            cv2.imshow('ASL Alphabet Recognition', frame)
            cv2.setWindowProperty('ASL Alphabet Recognition', cv2.WND_PROP_TOPMOST, 1)

            key = cv2.waitKey(1) & 0xFF
            if key == ord('q') or key == 27:
                print("\nExiting...")
                break
            elif cv2.getWindowProperty('ASL Alphabet Recognition', cv2.WND_PROP_VISIBLE) < 1:
                print("\nWindow closed by user")
                break

    cap.release()
    cv2.destroyAllWindows()
    print("Real-time inference stopped.")

def main():
    """Main function to train model and run inference"""
    
    # Step 1: Load dataset and train model
    model = load_and_train_model()
    
    if model is None:
        return
    
    # Step 2: Run real-time inference
    print("\n" + "="*60)
    print("Starting real-time inference in 3 seconds...")
    print("="*60)
    import time
    time.sleep(3)
    run_inference(model)

if __name__ == "__main__":
    main()
