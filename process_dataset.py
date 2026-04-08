"""
ASL Dataset Image Processor
This script processes images from the asl_dataset folder, extracts hand landmarks,
and creates a CSV file for training the classifier.

How to use:
1. Ensure your dataset is in data/asl_dataset/ folder with subfolders for each label
2. Run: python process_dataset.py
3. The script will process all images and create data/asl_dataset.csv
"""

import cv2
import mediapipe as mp
import numpy as np
import pandas as pd
import os
from tqdm import tqdm

# Initialize MediaPipe Hands using the tasks API
BaseOptions = mp.tasks.BaseOptions
HandLandmarker = mp.tasks.vision.HandLandmarker
HandLandmarkerOptions = mp.tasks.vision.HandLandmarkerOptions
VisionRunningMode = mp.tasks.vision.RunningMode

# Create hand landmarker
options = HandLandmarkerOptions(
    base_options=BaseOptions(model_asset_path='hand_landmarker.task'),
    running_mode=VisionRunningMode.IMAGE,
    num_hands=1,
    min_hand_detection_confidence=0.5,
    min_hand_presence_confidence=0.5,
    min_tracking_confidence=0.5
)

def normalize_landmarks(hand_landmarks_list, handedness=None):
    """Normalize landmarks and mirror left-hand samples into a common orientation."""
    coords = np.array([[lm.x, lm.y] for lm in hand_landmarks_list], dtype=np.float32)
    wrist = coords[0]
    normalized = coords - wrist

    if handedness and str(handedness).lower().startswith('left'):
        normalized[:, 0] *= -1

    x_min, y_min = normalized.min(axis=0)
    x_max, y_max = normalized.max(axis=0)
    scale = max(x_max - x_min, y_max - y_min)

    if scale > 0:
        normalized = normalized / scale

    return normalized.flatten()

def process_dataset(dataset_root='data/asl_dataset'):
    """
    Process all images in the dataset folder and extract hand landmarks
    
    Args:
        dataset_root: Path to the root folder containing class subfolders
        
    Returns:
        DataFrame with processed features and labels
    """
    print("\n" + "="*60)
    print("Processing ASL Dataset Images")
    print("="*60)
    
    if not os.path.exists(dataset_root):
        print(f"\n[X] Error: Dataset folder not found at {dataset_root}")
        return None
    
    # Create hand landmarker
    with HandLandmarker.create_from_options(options) as landmarker:
        # Collect all image paths and labels
        image_data = []
        
        # Get all class folders (0-9, a-z)
        class_folders = [d for d in os.listdir(dataset_root) 
                         if os.path.isdir(os.path.join(dataset_root, d))]
        class_folders.sort()
        
        print(f"\nFound {len(class_folders)} classes: {class_folders}\n")
        
        # Process each class folder
        for class_name in class_folders:
            class_path = os.path.join(dataset_root, class_name)
            
            # Get all images in the folder
            image_files = [f for f in os.listdir(class_path) 
                          if f.lower().endswith(('.jpg', '.jpeg', '.png', '.bmp'))]
            
            print(f"Processing class '{class_name}': {len(image_files)} images")
            
            success_count = 0
            fail_count = 0
            
            for img_file in tqdm(image_files, desc=f"  {class_name}", leave=False):
                img_path = os.path.join(class_path, img_file)
                
                # Read image
                image = cv2.imread(img_path)
                if image is None:
                    fail_count += 1
                    continue
                
                # Convert BGR to RGB
                rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                
                # Create MediaPipe Image object
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_image)
                
                # Process with MediaPipe
                detection_result = landmarker.detect(mp_image)
                
                if detection_result.hand_landmarks:
                    # Extract and normalize landmarks
                    hand_landmarks = detection_result.hand_landmarks[0]
                    handedness = None
                    if getattr(detection_result, 'handedness', None):
                        handedness = detection_result.handedness[0][0].category_name
                    normalized_features = normalize_landmarks(hand_landmarks, handedness)
                    
                    # Create feature dictionary
                    feature_dict = {'label': class_name.lower()}
                    for i, val in enumerate(normalized_features):
                        if i < 21:
                            feature_dict[f'x{i}'] = val
                        else:
                            feature_dict[f'y{i-21}'] = val
                    
                    image_data.append(feature_dict)
                    success_count += 1
                else:
                    fail_count += 1
            
            print(f"  [OK] Success: {success_count}, [X] Failed (no hand detected): {fail_count}")
    
    # Create DataFrame
    if len(image_data) == 0:
        print("\n[X] Error: No hand landmarks detected in any image!")
        return None
    
    df = pd.DataFrame(image_data)
    
    print(f"\n{'='*60}")
    print(f"Total processed samples: {len(df)}")
    print(f"{'='*60}")
    print("\nSamples per class:")
    print(df['label'].value_counts().sort_index())
    
    return df

def main():
    # Process the dataset
    df = process_dataset('data/asl_dataset')
    
    if df is not None:
        # Save to CSV
        output_path = 'data/asl_dataset.csv'
        os.makedirs('data', exist_ok=True)
        df.to_csv(output_path, index=False)
        print(f"\n[OK] Dataset saved to {output_path}")
        print("\nYou can now run: python inference_classifier.py")
    else:
        print("\n[X] Failed to process dataset")

if __name__ == "__main__":
    main()
