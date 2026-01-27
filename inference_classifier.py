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
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
import pickle
import os
from collections import deque, Counter

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

def normalize_landmarks(hand_landmarks_list):
    """
    Normalize hand landmarks relative to the wrist (landmark 0).
    This must match the normalization used in process_dataset.py
    
    Args:
        hand_landmarks_list: List of MediaPipe hand landmarks
        
    Returns:
        Flattened array of normalized x, y coordinates (42 features)
    """
    # Extract all landmark coordinates
    coords = []
    for lm in hand_landmarks_list:
        coords.append([lm.x, lm.y])
    
    coords = np.array(coords)
    
    # Get wrist position (landmark 0)
    wrist = coords[0]
    
    # Translate all points relative to wrist
    normalized = coords - wrist
    
    # Calculate bounding box for scale normalization
    x_min, y_min = normalized.min(axis=0)
    x_max, y_max = normalized.max(axis=0)
    
    # Calculate scale (max dimension)
    scale = max(x_max - x_min, y_max - y_min)
    
    # Avoid division by zero
    if scale > 0:
        normalized = normalized / scale
    
    # Flatten to 1D array (21 landmarks * 2 coordinates = 42 features)
    return normalized.flatten()

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
    X = df.drop('label', axis=1).values
    y = df['label'].values
    
    # Split data into training and testing sets
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    print(f"\nTraining set: {len(X_train)} samples")
    print(f"Testing set: {len(X_test)} samples")
    
    # Train Random Forest Classifier
    print("\nTraining Random Forest Classifier...")
    model = RandomForestClassifier(
        n_estimators=100,
        max_depth=20,
        random_state=42,
        n_jobs=-1
    )
    model.fit(X_train, y_train)
    print("[OK] Training complete!")
    
    # Evaluate the model
    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    
    print(f"\n{'='*60}")
    print(f"Model Accuracy: {accuracy * 100:.2f}%")
    print(f"{'='*60}")
    
    # Display classification report
    print("\nDetailed Classification Report:")
    print(classification_report(y_test, y_pred, zero_division=0))
    
    # Optional: Save the trained model
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
    
    # Create hand landmarker options for video mode
    options = HandLandmarkerOptions(
        base_options=BaseOptions(model_asset_path='hand_landmarker.task'),
        running_mode=VisionRunningMode.VIDEO,
        num_hands=1,
        min_hand_detection_confidence=0.7,
        min_hand_presence_confidence=0.5,
        min_tracking_confidence=0.5
    )
    
    # Open webcam
    cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)  # Use DirectShow on Windows for better compatibility
    
    if not cap.isOpened():
        print("Error: Could not open webcam. Trying alternate method...")
        cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            print("Error: Webcam access failed. Please check:")
            print("  1. Webcam is connected")
            print("  2. No other application is using the webcam")
            print("  3. Webcam permissions are granted")
            return
    
    # Set webcam properties for better performance
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    cap.set(cv2.CAP_PROP_FPS, 30)
    
    print("\n" + "="*60)
    print("Real-Time ASL Alphabet Recognition")
    print("="*60)
    print("\nInstructions:")
    print("  - Show your hand to the camera")
    print("  - Make ASL alphabet signs")
    print("  - The predicted letter will be displayed on screen")
    print("  - Press 'q' to quit")
    print("="*60 + "\n")
    
    # Variables for prediction smoothing
    prediction_buffer = deque(maxlen=5)
    frame_count = 0
    
    with HandLandmarker.create_from_options(options) as landmarker:
        while True:
            ret, frame = cap.read()
            if not ret:
                print("Error: Failed to capture frame")
                break
            
            # Flip frame horizontally for mirror effect
            frame = cv2.flip(frame, 1)
            
            # Convert BGR to RGB for MediaPipe
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # Create MediaPipe Image object
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
            
            # Use frame counter as timestamp (must be monotonically increasing)
            timestamp_ms = frame_count
            frame_count += 1
            
            # Process the frame to detect hands
            detection_result = landmarker.detect_for_video(mp_image, timestamp_ms)
            
            # Initialize prediction text
            prediction_text = "No hand detected"
            prediction_color = (0, 0, 255)  # Red
            
            # If hand is detected, make prediction
            if detection_result.hand_landmarks:
                hand_landmarks = detection_result.hand_landmarks[0]
                
                # Draw hand landmarks
                h, w, _ = frame.shape
                for i, lm in enumerate(hand_landmarks):
                    cx, cy = int(lm.x * w), int(lm.y * h)
                    cv2.circle(frame, (cx, cy), 5, (0, 255, 0), -1)
                
                # Draw connections
                for connection in HAND_CONNECTIONS:
                    start_idx = connection[0]
                    end_idx = connection[1]
                    start_lm = hand_landmarks[start_idx]
                    end_lm = hand_landmarks[end_idx]
                    start_point = (int(start_lm.x * w), int(start_lm.y * h))
                    end_point = (int(end_lm.x * w), int(end_lm.y * h))
                    cv2.line(frame, start_point, end_point, (255, 0, 0), 2)
                
                # Normalize landmarks
                normalized_landmarks = normalize_landmarks(hand_landmarks)
                
                # Reshape for prediction (model expects 2D array)
                features = normalized_landmarks.reshape(1, -1)
                
                # Make prediction
                prediction = model.predict(features)[0]
                confidence = model.predict_proba(features).max()
                
                # Add to buffer for smoothing
                prediction_buffer.append(prediction)
                
                # Get most common prediction from buffer
                if len(prediction_buffer) > 0:
                    most_common = Counter(prediction_buffer).most_common(1)[0][0]
                    
                    prediction_text = f"Prediction: {most_common}"
                    prediction_color = (0, 255, 0)  # Green
                    
                    # Display confidence
                    confidence_text = f"Confidence: {confidence * 100:.1f}%"
                    cv2.putText(frame, confidence_text,
                               (10, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
            
            # Create a semi-transparent overlay for better text visibility
            overlay = frame.copy()
            cv2.rectangle(overlay, (5, 5), (400, 100), (0, 0, 0), -1)
            cv2.addWeighted(overlay, 0.3, frame, 0.7, 0, frame)
            
            # Display prediction
            cv2.putText(frame, prediction_text,
                       (10, 40), cv2.FONT_HERSHEY_SIMPLEX, 1.2, prediction_color, 3)
            
            # Display instructions
            cv2.putText(frame, "Press 'q' to quit",
                       (10, frame.shape[0] - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
            
            # Display frame
            cv2.imshow('ASL Alphabet Recognition', frame)
            cv2.setWindowProperty('ASL Alphabet Recognition', cv2.WND_PROP_TOPMOST, 1)
            
            # Check for quit command
            key = cv2.waitKey(1) & 0xFF
            if key == ord('q') or key == 27:  # 'q' or ESC
                print("\nExiting...")
                break
            elif cv2.getWindowProperty('ASL Alphabet Recognition', cv2.WND_PROP_VISIBLE) < 1:
                print("\nWindow closed by user")
                break
    
    # Release resources
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
