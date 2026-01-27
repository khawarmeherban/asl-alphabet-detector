# ASL Alphabet Detector & Communication System

A comprehensive American Sign Language (ASL) communication system using Python, OpenCV, MediaPipe, and Machine Learning. This project includes real-time ASL recognition, text-to-speech, speech-to-text, and bidirectional communication features.

## Features

### Core Features
- 🖐️ **Hand Detection**: Uses MediaPipe for accurate hand landmark detection
- 🤖 **Machine Learning**: Random Forest classifier with 94.46% accuracy
- 📹 **Real-Time Inference**: Live webcam feed with instant ASL letter recognition
- 🎯 **Normalized Features**: Distance-invariant hand landmarks for robust predictions
- 📊 **Dataset Processing**: Process image datasets to extract hand landmarks

### Advanced Features
- 🔊 **Text-to-Speech**: Convert ASL signs to spoken words
- 🎤 **Speech-to-Text**: Voice input for bidirectional communication
- 🌐 **Multi-Language Support**: 8 languages (English, Spanish, French, German, Italian, Portuguese, Hindi, Chinese)
- 💬 **Conversation Mode**: Full conversation history with timestamps
- 🔄 **Bidirectional Communication**: ASL users ↔ Hearing people communication bridge

## Project Structure

```
.
├── data/
│   ├── asl_dataset/          # Dataset images (download separately)
│   ├── asl_dataset.csv       # Extracted hand landmarks (generated)
│   └── asl_model.pkl         # Trained classifier model (generated)
├── process_dataset.py         # Process images and extract landmarks
├── inference_classifier.py    # Train model and real-time ASL detection
├── asl_translator.py          # ASL to text with speech output
├── asl_bidirectional.py       # Full bidirectional communication system
├── test_webcam.py             # Test webcam functionality
├── hand_landmarker.task       # MediaPipe hand detection model
├── requirements.txt           # Python dependencies
├── .gitignore                 # Git ignore file
└── README.md                  # This file
```

## Installation

1. **Clone this repository**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/asl-alphabet-detector.git
   cd asl-alphabet-detector
   ```

2. **Install required packages**:
   ```bash
   pip install -r requirements.txt
   ```

   Required packages:
   - opencv-python
   - mediapipe
   - scikit-learn
   - numpy
   -Quick Start (Using Pre-trained Model)

If you have the pre-trained model (`data/asl_model.pkl`), you can jump straight to:

```bash
# Basic ASL detection
python inference_classifier.py

# ASL with text-to-speech
python asl_translator.py

# Full bidirectional communication
python asl_bidirectional.py
```

### Training Your Own Model

#### Step 1: Process Dataset Images

If you have a dataset of ASL images in `data/asl_dataset/`:

```bash
python process_dataset.py
```

This will:
- Process all images in the dataset folders
- Extract hand landmarks using MediaPipe
- Create `data/asl_dataset.csv` with 1,622+ samples

#```

**Instructions:**
1. Position your hand in front of the webcam
2. Make the ASL sign for a letter (e.g., 'A')
3. Press the corresponding key on your keyboard (e.g., 'A')
4. The script will capture and save the hand landmark data
5. Repeat for multiple samples of each letter (recommended: 50-100 samples per letter)
6. Press 's' to save data periodically
7. Press 'q' to quit


### Step 3: ASL Translation with Speech

Run the translator for ASL-to-text with speech output:

```bash
python asl_translator.py
```

**Features:**
- Real-time ASL sign detection
- Automatic text accumulation
- Text-to-speech output (press 'V')
- Multi-language support (press 'L')
- Conversation history (press 'H')

**Keyboard Controls:**
- `S` - Add space
- `B` - Backspace
- `C` - Clear text (saves to history)
- `V` - Speak text aloud
- `H` - Show conversation history
- `T` - Translate text
- `L` - Change language
- `Q` - Quit

### Step 4: Bidirectional Communication

Run the full communication system with both ASL and voice:

```bash
python asl_bidirectional.py
```

**Features:**
- ASL → Text → Speech (for hearing people)
- Voice → Text (for ASL users to read)
- Real-time bidirectional conversation
- Complete conversation history
- Both modes work simultaneously

**Keyboard Controls:**
- `M` - Toggle microphone ON/OFF
- `V` - Speak ASL text aloud
- `R` - Read speech text aloud (echo)
- `S` - Add space
- `B` - Backspace
- `Cprocess_dataset.py
- Processes images from `data/asl_dataset/` folder
- Extracts hand landmarks using MediaPipe
- Normalizes landmark coordinates
- Creates CSV file with features and labels
- Handles 36 classes (0-9, a-z)

### inference_classifier.py
- Loads dataset from CSV
- Trains Random Forest classifier (100 trees)
- Achieves 94.46% accuracy
- Saves trained model to pickle file
- Runs real-time inference with webcam
- Displays predicted letter and confidence score

### asl_translator.py
- Real-time ASL sign detection
- Converts signs to text automatically
- Text-to-speech output
- Multi-language translation support
- Conversation history with timestamps
- Smart debouncing (requires 8 stable frames)

### asl_bidirectional.py
- Full bidirectional communication system
- ASL recognition (signs → text)
- Speech recognition (voice → text)
- Text-to-speech for both directions
- Real-time conversation with dual input
- Complete conversation history with speaker identification

### test_webcam.py
- Simple webcam test utility
- Verifies OpenCV and webcam functionality
- Helpful for troubleshooting
```bash
python inference_classifier.py
```

**What happens:**
1. The script loads your collected data from `data/asl_dataset.csv`
2. Trains a Random Forest classifier (80/20 train/test split)
3. Displays model accuracy and classification report
4. Saves the trained model to `data/asl_model.pkl`
5. Opens webcam for real-time ASL letter prediction
6. Shows predicted letter on screen with confidence score

Press 'q' to quit the real-time inference.

## How It Works

### Hand Landmark Normalization

The project uses MediaPipe to detect 21 hand landmarks. To make predictions invariant to:
- Hand position (left/right/up/down in frame)
- Distance from camera
- Hand size

The landmarks are normalized by:
1. **Translation**: All coordinates are made relative to the wrist (landmark 0)
2. **Scaling**: Coordinates are scaled by the maximum bounding box dimension

ThiModel Performance

- **Algorithm**: Random Forest (100 trees, max depth 20)
- **Accuracy**: 94.46%
- **Training Set**: 1,297 samples
- **Testing Set**: 325 samples
- **Classes**: 36 (0-9, a-z)
- **Features**: 42 normalized hand landmarks (21 points × 2 coordinates)

## Troubleshooting

### Webcam Issues
- Ensure webcam is connected and not in use
- Try `test_webcam.py` to verify functionality
- Check camera permissions in Windows settings

### Speech Recognition Issues
- Ensure microphone is connected and working
- Check microphone permissions
- Requires internet for Google Speech API
- Press 'M' to toggle microphone on/off

### Model Not Found
- Run `python inference_classifier.py` first to train the model
- Or ensure `data/asl_model.pkl` exists

### Hand Not Detected
- Ensure good lighting
- Keep hand fully visible in frame
- Try different distances from camera
- Adjust detection confidence in code

## Future Enhancements

- [ ] Deep learning model (CNN/LSTM) for better accuracy
- [ ] Dynamic gesture recognition for motion-based signs (J, Z)
- [ ] Facial expression detection for ASL grammar
- [ ] Web-based interface (Streamlit/Flask)
- [ ] Support for two-handed signs
- [ ] Word prediction and auto-complete
- [ ] Mobile app version (Android/iOS)
- [ ] Real-time video chat with ASL overlay
- [ ] Custom gesture training interface

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## Credits

- **MediaPipe**: Google's hand tracking solution
- **OpenCV**: Computer vision library
- **Scikit-learn**: Machine learning framework
- **pyttsx3**: Text-to-speech library
- **SpeechRecognition**: Speech-to-text library

## License

This project is open-source and available for educational purposes.

## Acknowledgments

- ASL dataset from various sources
- Inspired by the need for better accessibility in communication
- Built to bridge the gap between ASL users and hearing individuals

---

## Contact

For questions, issues, or suggestions, please open an issue on GitHub.

Happy signing! 🤟 🎤 💬
### inference_classifier.py
- Loads collected dataset from CSV
- Trains Random Forest classifier
- Evaluates model performance
- Saves trained model to pickle file
- Runs real-time inference with webcam
- Displays predicted letter and confidence score

## Troubleshooting

### Webcam not opening
- Ensure your webcam is connected and not being used by another application
- Try changing the camera index in `cv2.VideoCapture(0)` to `cv2.VideoCapture(1)` or `cv2.VideoCapture(2)`

### Low accuracy
- Collect more samples per letter (50-100 recommended)
- Ensure consistent hand positioning during data collection
- Make sure ASL signs are clearly visible to the camera
- Check that hand is well-lit and fully visible

### Hand not detected
- Ensure good lighting conditions
- Move hand closer to camera
- Adjust `min_detection_confidence` and `min_tracking_confidence` in the code

### Module not found errors
- Make sure all dependencies are installed: `pip install -r requirements.txt`
- Try creating a virtual environment first

## Customization

### Use SVM instead of Random Forest

In `inference_classifier.py`, replace the RandomForestClassifier with SVM:

```python
from sklearn.svm import SVC

model = SVC(kernel='rbf', C=1.0, gamma='scale', probability=True)
```

### Add more features (z-coordinates)

Modify the `normalize_landmarks()` function to include z-coordinates for 3D hand tracking (63 features total).

### Change data format to pickle

In `data_collector.py`, you can save data as pickle instead of CSV for faster loading with large datasets.

## Future Enhancements

- [ ] Add support for ASL words and phrases
- [ ] Implement dynamic gesture recognition for motion-based signs
- [ ] Add a GUI for easier data collection
- [ ] Support for both hands
- [ ] Real-time data augmentation
- [ ] Deploy as a web app using Flask/Streamlit

## Credits

- **MediaPipe**: Google's hand tracking solution
- **OpenCV**: Computer vision library
- **Scikit-learn**: Machine learning framework

## License

This project is open-source and available for educational purposes.

---

Happy signing! 🤟
