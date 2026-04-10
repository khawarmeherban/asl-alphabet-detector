"""
ASL Alphabet Data Collector
This script captures hand landmarks using MediaPipe and saves them for training.

How to use:
1. Run the script: python data_collector.py
2. Show your hand to the webcam
3. Press keys A-Z to capture and label hand gestures for each letter
4. Press 'q' to quit
5. Data will be saved to data/asl_dataset.csv
"""

import cv2
from mediapipe import solutions
import csv
import os
import time

from asl_feature_utils import normalize_landmarks

# Initialize MediaPipe Hands using the new API
mp_hands = solutions.hands
mp_drawing = solutions.drawing_utils
mp_drawing_styles = solutions.drawing_styles

hands = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=1,
    min_detection_confidence=0.7,
    min_tracking_confidence=0.5
)

# Data storage
dataset_path = 'data/asl_dataset.csv'
data_samples = []


def save_dataset():
    """Save collected data to CSV file"""
    os.makedirs('data', exist_ok=True)
    
    # Check if file exists to determine if we need headers
    file_exists = os.path.exists(dataset_path)
    
    with open(dataset_path, 'a', newline='') as f:
        writer = csv.writer(f)
        
        # Write header if file is new
        if not file_exists:
            header = ['label'] + [f'x{i}' for i in range(21)] + [f'y{i}' for i in range(21)]
            writer.writerow(header)
        
        # Write all collected samples
        writer.writerows(data_samples)
    
    data_samples.clear()
    print(f"✓ Data saved to {dataset_path}")

def main():
    # Open webcam
    cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        print("Error: Could not open webcam")
        return
    
    print("\n" + "="*60)
    print("ASL Alphabet Data Collector")
    print("="*60)
    print("\nInstructions:")
    print("  - Show your hand to the camera")
    print("  - Press A-Z or 0-9 keys to capture and label hand gestures")
    print("  - Samples are saved in lowercase labels for consistency")
    print("  - Press 's' to save collected data")
    print("  - Press 'q' to quit")
    print("="*60 + "\n")
    
    sample_count = {}
    last_capture_time = 0.0
    capture_cooldown = 0.20
    
    while True:
        ret, frame = cap.read()
        if not ret:
            print("Error: Failed to capture frame")
            break
        
        # Flip frame horizontally for mirror effect
        frame = cv2.flip(frame, 1)
        
        # Convert BGR to RGB for MediaPipe
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        # Process the frame to detect hands
        results = hands.process(rgb_frame)
        
        # Draw hand landmarks
        if results.multi_hand_landmarks:
            for hand_landmarks in results.multi_hand_landmarks:
                # Draw landmarks on frame
                mp_drawing.draw_landmarks(
                    frame,
                    hand_landmarks,
                    mp_hands.HAND_CONNECTIONS,
                    mp_drawing.DrawingSpec(color=(0, 255, 0), thickness=2, circle_radius=2),
                    mp_drawing.DrawingSpec(color=(255, 0, 0), thickness=2)
                )
                
                # Display status
                cv2.putText(frame, "Hand Detected - Press A-Z to capture",
                           (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        else:
            cv2.putText(frame, "No hand detected",
                       (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
        
        # Display sample counts
        y_offset = 60
        for letter, count in sorted(sample_count.items()):
            cv2.putText(frame, f"{letter}: {count} samples",
                       (10, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
            y_offset += 25
        
        # Display frame
        cv2.imshow('ASL Data Collector', frame)
        
        # Handle key presses
        key = cv2.waitKey(1) & 0xFF
        
        # Quit
        if key == ord('q'):
            print("\nExiting...")
            break
        
        # Save data
        elif key == ord('s'):
            if len(data_samples) > 0:
                save_dataset()
            else:
                print("No data to save!")
        
        # Capture data for letters A-Z and digits 0-9
        elif 32 <= key <= 126 and chr(key).upper() in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789':
            if time.time() - last_capture_time < capture_cooldown:
                continue
            if results.multi_hand_landmarks:
                label = chr(key).lower()
                handedness = None
                if results.multi_handedness:
                    handedness = results.multi_handedness[0].classification[0].label

                normalized_landmarks = normalize_landmarks(results.multi_hand_landmarks[0], handedness)
                data_row = [label] + normalized_landmarks.tolist()
                data_samples.append(data_row)

                sample_count[label] = sample_count.get(label, 0) + 1
                last_capture_time = time.time()

                print(f"✓ Captured sample for '{label}' (Total: {sample_count[label]})")
            else:
                print("✗ No hand detected! Please show your hand to the camera.")
    
    # Save any remaining data before closing
    if len(data_samples) > 0:
        save_dataset()
    
    # Release resources
    cap.release()
    cv2.destroyAllWindows()
    hands.close()
    
    print("\nData collection complete!")
    print(f"Total samples collected: {sum(sample_count.values())}")

if __name__ == "__main__":
    main()
