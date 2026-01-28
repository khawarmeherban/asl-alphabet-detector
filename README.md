# 🤟 ASL Alphabet Detector & Communication System

> **AI-Powered American Sign Language Recognition with Gesture Control**

A comprehensive full-stack application combining Python, React, MediaPipe, and Machine Learning for real-time ASL alphabet detection, gesture-based media control, and bidirectional sign language communication. Features a modern web interface with 94.46% ML accuracy.

---

## ✨ Features Overview

### 🎥 **Real-Time ASL Detection**
- Hand tracking with 21 landmark points (MediaPipe)
- Instant letter recognition (A-Z, 0-9)
- 94.46% accuracy (Random Forest classifier)
- Live webcam inference with confidence scoring
- Text translation with space/backspace support

### 🎮 **Gesture Control System** ⭐ NEW
- Control YouTube videos with hand gestures
- **6 gesture types:** Open Hand, Fist, Peace Sign, Three Fingers, Thumbs Up, One Finger
- **Actions:** Play/Pause, Volume (0-100%), Brightness (0-100%), Next Video, Mute
- Real-time visual effects with buffer zones
- Smart debouncing (50-200ms) to prevent accidental triggers

### 🌐 **Full-Stack Web Application**
- **Frontend:** React 18, TailwindCSS, MediaPipe Hands
- **Backend:** Flask, Socket.IO, scikit-learn
- **Modern UI:** Indigo-Purple-Pink gradient theme with glass morphism
- **6 Pages:** Home, Live Detection, Gesture Control, Bidirectional, Analytics, History
- **Responsive:** Works on desktop, tablet, mobile
- **Accessible:** WCAG AA compliant with keyboard navigation

### 🔄 **Bidirectional Communication**
- ASL to Text/Speech conversion
- Speech to ASL visualization
- Text to ASL animated representations
- Multi-language support (8 languages)
- Conversation history (up to 500 interactions)

### 📊 **Analytics & Insights**
- Detection accuracy tracking over time
- Letter frequency statistics
- Usage metrics and performance graphs
- Session duration monitoring
- Export to text/PDF

---

## 🚀 Quick Start

### Web Application (Recommended)

**Full-stack React + Flask web app with gesture control:**

```bash
# 1. Start Backend (Terminal 1)
cd asl-web-app/backend
pip install -r requirements.txt
python app.py
# Backend: http://localhost:5000

# 2. Start Frontend (Terminal 2)
cd asl-web-app/frontend
npm install
npm start
# Frontend: http://localhost:3000
```

📖 **[Complete Web App Documentation](asl-web-app/README.md)**  
🎮 **[Gesture Control Guide](asl-web-app/FEATURES_DOCUMENTATION.md)**  
🧪 **[Testing Checklist](asl-web-app/TESTING_CHECKLIST.md)**

### Python Scripts (Standalone)

**For ML training and command-line inference:**

```bash
# Install dependencies
pip install -r requirements.txt

# 1. Process dataset (extract landmarks)
python process_dataset.py

# 2. Train model and test inference
python inference_classifier.py

# 3. Run ASL translator with TTS
python asl_translator.py

# 4. Full bidirectional communication
python asl_bidirectional.py
```

---

## 📁 Project Structure

```
asl-alphabet-detector/
├── asl-web-app/                        # Full-stack web application ⭐
│   ├── frontend/                       # React.js application
│   │   ├── src/
│   │   │   ├── pages/                 # 6 application pages
│   │   │   │   ├── HomePage.js
│   │   │   │   ├── LiveDetection.js   # ASL detection (482 lines)
│   │   │   │   ├── GestureControl.js  # Gesture system (881 lines) ⭐
│   │   │   │   ├── BidirectionalPage.js
│   │   │   │   ├── AnalyticsPage.js
│   │   │   │   └── HistoryPage.js
│   │   │   ├── App.js                 # Main routing
│   │   │   ├── index.css              # Modern theme (505 lines)
│   │   │   └── index.js
│   │   ├── public/
│   │   ├── package.json
│   │   └── build/                     # Production build
│   │
│   ├── backend/                       # Flask API server
│   │   ├── app.py                    # 8 endpoints + Socket.IO
│   │   ├── requirements.txt
│   │   └── Procfile
│   │
│   ├── README.md                      # Web app overview
│   ├── FEATURES_DOCUMENTATION.md      # Complete features guide ⭐
│   ├── TESTING_CHECKLIST.md          # Comprehensive testing ⭐
│   ├── SETUP_GUIDE.md                # Local development
│   ├── DEPLOYMENT_GUIDE.md           # Production deployment
│   └── DEPLOY_QUICK.md               # Quick deploy (10 min)
│
├── data/
│   ├── asl_dataset/                  # Training images (87,000+)
│   ├── asl_dataset.csv               # Extracted landmarks (generated)
│   └── asl_model.pkl                 # Trained model (generated)
│
├── process_dataset.py                 # Process images → landmarks CSV
├── inference_classifier.py            # Train model + live inference
├── asl_translator.py                  # ASL → Text → Speech
├── asl_bidirectional.py              # Full bidirectional system
├── test_webcam.py                    # Test webcam functionality
├── data_collector.py                 # Collect training data
├── hand_landmarker.task              # MediaPipe model file
├── requirements.txt                  # Python dependencies
└── README.md                         # This file
```

---

## 🛠️ Technology Stack

### Web Application
| Component | Technology | Purpose |
|-----------|------------|---------|
| **Frontend** | React 18.3.1 | UI framework |
| **Styling** | TailwindCSS 3.x | Modern styling |
| **Hand Tracking** | MediaPipe Hands 0.4 | 21-point landmark detection |
| **Video Player** | YouTube IFrame API | Gesture-controlled videos |
| **Icons** | Lucide React | UI icons |
| **Real-time** | Socket.IO Client | WebSocket communication |
| **Backend** | Flask 3.0+ | API server |
| **ML Model** | scikit-learn | Random Forest (94.46%) |
| **Computer Vision** | MediaPipe + OpenCV | Hand detection |
| **Deep Learning** | TensorFlow/Keras | Model training |

### Python Scripts
- **Python 3.13.11** - Runtime
- **OpenCV** - Image processing
- **MediaPipe** - Hand landmark detection
- **scikit-learn** - Random Forest classifier
- **TensorFlow** - Neural network training (optional)
- **pyttsx3** - Text-to-speech
- **SpeechRecognition** - Speech-to-text
- **NumPy** - Numerical operations
- **Pandas** - Data manipulation

---

## 📊 Machine Learning Details

### Model Architecture
- **Algorithm:** Random Forest Classifier
- **Features:** 63 (21 landmarks × 3 coordinates: x, y, z)
- **Classes:** 36 (A-Z letters + 0-9 digits)
- **Training Data:** 87,000+ images (3,000 per character)
- **Validation Split:** 80/20 train/test
- **Accuracy:** **94.46%** on test set

### Feature Engineering
1. **Extract 21 hand landmarks** from each image
2. **Normalize coordinates** (distance-invariant)
3. **Calculate relative positions** (wrist as origin)
4. **Scale features** using StandardScaler
5. **Train Random Forest** (100 estimators, max depth 10)

### Training Process
```bash
# 1. Place images in data/asl_dataset/
# Structure: data/asl_dataset/A/, data/asl_dataset/B/, etc.

# 2. Extract landmarks and create CSV
python process_dataset.py
# Output: data/asl_dataset.csv

# 3. Train model
python inference_classifier.py
# Output: data/asl_model.pkl (94.46% accuracy)
```

---

## 🎮 Gesture Control Mapping

| Gesture | Finger Position | Action | Confidence | Debounce |
|---------|----------------|--------|------------|----------|
| **Open Hand** | All 5 up | Brightness Control (0-100%) | 0.85 | 50ms |
| **One Finger** | Index up | Volume Control (0-100%) | 0.85 | 50ms |
| **Fist** | All closed | Play/Pause Toggle | 0.80 | 150ms |
| **Two Fingers** | Index + Middle up | Mute/Unmute | 0.85 | 150ms |
| **Three Fingers** | Thumb + Index + Middle (Pinky down) | Next Video | 0.85 | 200ms |
| **Thumbs Up** | Only thumb up | Reserved (future) | 0.85 | 150ms |

**Buffer Zones:**
- Top 25% of screen → Value = 100%
- Bottom 25% of screen → Value = 0%
- Middle 50% → Smooth linear interpolation (0-100%)

---

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
