# 🤟 ASL Alphabet Detector Web Application

> **Modern, AI-powered American Sign Language recognition with gesture control**

A full-stack web application combining React.js and Flask to provide real-time ASL alphabet detection, gesture-based media controls, and bidirectional sign language communication. Built with MediaPipe Hands, TensorFlow, and a Random Forest classifier achieving **94.46% accuracy**.

---

## ✨ Key Features

### 🎥 **Live ASL Detection**
- Real-time hand tracking with 21 landmark points
- Instant letter recognition (A-Z, 0-9)
- Text translation with space/backspace support
- Confidence scoring and visual feedback
- **Accuracy:** 94.46% on test dataset

### 🎮 **Gesture Control System** ⭐ NEW
- Control YouTube videos with hand gestures
- **6 gesture types:** Open Hand, Fist, Peace Sign, Three Fingers, Thumbs Up, One Finger
- **Actions:** Play/Pause, Volume, Brightness, Next Video, Mute
- Real-time visual effects and feedback
- Smart debouncing and buffer zones

### 🔄 **Bidirectional Translation**
- ASL to Text conversion
- Text to ASL visualization
- Speech recognition integration
- Animated sign representations

### 📊 **Analytics & History**
- Usage statistics and performance metrics
- Detection accuracy tracking
- Conversation history (up to 500 interactions)
- Export to text/PDF

### 🎨 **Modern UI/UX**
- **Color Theme:** Indigo-Purple-Pink gradient
- Glass morphism effects with backdrop blur
- Smooth animations and transitions
- Fully responsive design
- WCAG AA accessibility compliant

---

## 🌐 Live Demo

**Frontend:** https://khawarmeherban.github.io/asl-web-app/  
**Backend:** Deploy your own to Render.com (see [DEPLOY_QUICK.md](DEPLOY_QUICK.md))

---

## 📋 Documentation

📖 **[Complete Features Documentation](FEATURES_DOCUMENTATION.md)** - Detailed guide covering:
- All pages and functionality
- Gesture control system with mapping table
- YouTube integration and customization
- Troubleshooting common issues
- Browser compatibility
- Accessibility features

📘 **[Setup Guide](SETUP_GUIDE.md)** - Local development setup  
🚀 **[Deployment Guide](DEPLOYMENT_GUIDE.md)** - Production deployment to Render & GitHub Pages  
⚡ **[Quick Deploy](DEPLOY_QUICK.md)** - Fast deployment instructions

---

## 🛠️ Technology Stack

### Frontend
- **React** 18.3.1 - UI framework
- **MediaPipe Hands** 0.4 - Hand landmark detection
- **TailwindCSS** 3.x - Styling
- **YouTube IFrame API** - Video player
- **Lucide React** - Icon library
- **Socket.IO Client** - Real-time communication

### Backend
- **Python** 3.13.11 - Runtime
- **Flask** 3.0+ - Web framework
- **MediaPipe** - Computer vision
- **scikit-learn** - Random Forest classifier (94.46% accuracy)
- **TensorFlow/Keras** - Model training
- **Flask-SocketIO** - WebSocket support
- **OpenCV** - Image processing

### Machine Learning
- **Model:** Random Forest Classifier
- **Features:** 63 (21 landmarks × 3 coordinates)
- **Classes:** 36 (26 letters + 10 digits)
- **Training Data:** 87,000+ images
- **Accuracy:** 94.46% on validation set

---

## 📁 Project Structure

```
asl-web-app/
├── frontend/                      # React.js application
│   ├── src/
│   │   ├── pages/                # Application pages
│   │   │   ├── HomePage.js       # Landing page
│   │   │   ├── LiveDetection.js  # ASL detection (482 lines)
│   │   │   ├── GestureControl.js # Gesture system (881 lines) ⭐
│   │   │   ├── BidirectionalPage.js
│   │   │   ├── AnalyticsPage.js
│   │   │   └── HistoryPage.js
│   │   ├── App.js                # Main routing
│   │   ├── index.css             # Modern theme (505 lines)
│   │   └── index.js              # Entry point
│   ├── public/
│   │   └── index.html
│   ├── package.json
│   └── build/                    # Production build
│
├── backend/                       # Flask API server
│   ├── app.py                    # 8 endpoints + Socket.IO
│   ├── requirements.txt
│   └── Procfile                  # Render deployment
│
├── FEATURES_DOCUMENTATION.md      # Complete features guide ⭐ NEW
├── SETUP_GUIDE.md                # Local development
├── DEPLOYMENT_GUIDE.md           # Production deployment
├── DEPLOY_QUICK.md               # Quick start
└── README.md                     # This file
```

---

## ⚙️ Quick Start

### Prerequisites
- **Python** 3.8+ (Python 3.13.11 recommended)
- **Node.js** 16+
- **Webcam** (required for live features)
- **Trained ML model** at `../../data/asl_model.pkl`

### Backend Setup (2 minutes)

```bash
cd asl-web-app/backend
pip install -r requirements.txt
python app.py
```

✅ Backend runs on **http://localhost:5000**

### Frontend Setup (2 minutes)

```bash
cd asl-web-app/frontend
npm install
npm start
```

✅ Frontend runs on **http://localhost:3000**

🎉 **Open http://localhost:3000** to use the application!

---

## 🚀 Deploy to Production (FREE)

Deploy your own live version in **10 minutes**:

1. **Backend to Render.com**: See [DEPLOY_QUICK.md](DEPLOY_QUICK.md)
2. **Frontend to GitHub Pages**: `npm run deploy` in frontend folder

Both services offer **free tiers** perfect for personal projects!

---

## 🎯 Usage Guide

### 📹 Live ASL Detection
1. Navigate to **Live Detection** page
2. Click **"Start Camera"** button
3. Grant camera permissions
4. Show ASL alphabet signs to webcam
5. See real-time predictions with confidence scores
6. Translated text appears below video
7. Use **"Speak Text"** for text-to-speech

### 🎮 Gesture Control System
1. Navigate to **Gesture Control** page
2. Click **"Start Camera"** button
3. Grant camera permissions
4. Use gestures to control:
   - **Open Hand (5 fingers):** Control brightness
   - **One Finger (Index):** Control volume
   - **Fist:** Play/Pause YouTube video
   - **Two Fingers (Peace):** Mute/Unmute
   - **Three Fingers (Pinky down):** Next video
5. See real-time visual feedback on controls

### 🔄 Bidirectional Translation
1. Navigate to **Bidirectional** page
2. Choose mode: ASL to Text or Text to ASL
3. Click microphone icon for voice input
4. View animated ASL representations

### 📊 Analytics & History
- **Analytics:** View detection accuracy and usage statistics
- **History:** Browse up to 500 saved conversations
- **Export:** Download translations as text/PDF

---

## 📡 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Server health check |
| `/predict` | POST | ASL prediction from hand landmarks |
| `/predict-words` | POST | Word suggestions based on input |
| `/speak` | POST | Text-to-speech conversion |
| `/history` | GET/POST/DELETE | Conversation history CRUD |
| `/statistics` | GET | Usage analytics and metrics |

**Request Example (ASL Prediction):**
```json
POST /predict
{
  "landmarks": [[x1, y1, z1], [x2, y2, z2], ... [x21, y21, z21]]
}
```

**Response Example:**
```json
{
  "prediction": "A",
  "confidence": 0.946
}
```

---

## 🎨 Customization

### Change YouTube Videos
Edit `youtubePlaylist` array in [frontend/src/pages/GestureControl.js](frontend/src/pages/GestureControl.js#L30):
```javascript
const youtubePlaylist = [
  'YOUR_VIDEO_ID_1',
  'YOUR_VIDEO_ID_2',
  'YOUR_VIDEO_ID_3',
  'YOUR_VIDEO_ID_4'
];
```

### Modify Color Theme
Edit CSS variables in [frontend/src/index.css](frontend/src/index.css):
```css
:root {
  --color-primary: #6366f1;     /* Your primary color */
  --color-secondary: #ec4899;   /* Your secondary color */
  --color-accent: #8b5cf6;      /* Your accent color */
}
```

### Adjust Gesture Sensitivity
Edit confidence thresholds in [frontend/src/pages/GestureControl.js](frontend/src/pages/GestureControl.js):
```javascript
// Line ~350
const confidence = 0.85; // Adjust 0.0 to 1.0 (higher = stricter)
```

---

## 🌐 Browser Compatibility

| Browser | Status | Notes |
|---------|--------|-------|
| ✅ **Chrome** 90+ | Full support | Recommended |
| ✅ **Edge** 90+ | Full support | Recommended |
| ✅ **Firefox** 88+ | Full support | Good performance |
| ⚠️ **Safari** 14+ | Limited | MediaPipe issues |
| ✅ **Opera** 76+ | Full support | - |

**Requirements:**
- WebRTC support (camera access)
- WebAssembly support (MediaPipe)
- JavaScript ES6+
- Minimum 4GB RAM

---

## 🐛 Common Issues & Solutions

### ❌ **Camera Not Working**
**Problem:** Black screen or "Camera not accessible"

**Solutions:**
- ✅ Grant camera permissions in browser settings
- ✅ Close other apps using camera (Zoom, Skype)
- ✅ Try different browser (Chrome recommended)
- ✅ Check system camera privacy settings

### ❌ **Backend Connection Failed**
**Problem:** "Failed to connect to backend"

**Solutions:**
- ✅ Ensure backend is running: `python app.py`
- ✅ Check port 5000 is not in use
- ✅ Verify CORS settings in `backend/app.py`
- ✅ Check firewall allows Python

### ❌ **Gestures Not Detected**
**Problem:** Hand gestures not recognized

**Solutions:**
- ✅ Improve lighting (bright, even light)
- ✅ Keep hand centered in frame (1-3 feet away)
- ✅ Show full hand with all fingers visible
- ✅ Hold gesture for 200-300ms
- ✅ Make distinct finger positions

### ❌ **ML Model Not Found**
**Problem:** "FileNotFoundError: asl_model.pkl"

**Solutions:**
- ✅ Train model first: `python process_dataset.py`
- ✅ Ensure model exists at `../../data/asl_model.pkl`
- ✅ Check relative path from backend folder

### ❌ **YouTube Video Not Playing**
**Problem:** Video player shows error

**Solutions:**
- ✅ Check video IDs are valid
- ✅ Use public, embeddable videos
- ✅ Test video ID: `https://youtube.com/watch?v=VIDEO_ID`
- ✅ Check internet connection

📖 **More solutions:** See [FEATURES_DOCUMENTATION.md](FEATURES_DOCUMENTATION.md#-troubleshooting)

---

## 📚 Complete Documentation

- 📖 **[FEATURES_DOCUMENTATION.md](FEATURES_DOCUMENTATION.md)** - Complete feature guide with gesture mapping, troubleshooting, and customization
- 📘 **[SETUP_GUIDE.md](SETUP_GUIDE.md)** - Detailed local development setup
- 🚀 **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** - Production deployment (Render + GitHub Pages)
- ⚡ **[DEPLOY_QUICK.md](DEPLOY_QUICK.md)** - Quick 10-minute deployment

---

## 🤝 Contributing

Contributions are welcome! Areas for improvement:
- [ ] Add more gesture types (6-finger, 7-finger combinations)
- [ ] Support multiple hand tracking
- [ ] Add ASL words/phrases (beyond alphabet)
- [ ] Improve mobile responsiveness
- [ ] Add dark/light theme toggle
- [ ] Implement user accounts and cloud history

---

## 📝 License

MIT License - Free for educational and personal use

```
Copyright (c) 2025 ASL Alphabet Detector

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
```

---

## 🙏 Acknowledgments

- **MediaPipe** by Google - Hand landmark detection
- **scikit-learn** - Machine learning algorithms
- **React** - UI framework
- **Flask** - Backend framework
- **ASL Dataset** - Training data for classifier

---

## 👨‍💻 Developer

**GitHub:** [khawarmeherban/asl-alphabet-detector](https://github.com/khawarmeherban/asl-alphabet-detector)

**Tech Stack Expertise:**
- React.js, Flask, Python
- MediaPipe, TensorFlow, scikit-learn
- Computer Vision, Machine Learning
- Real-time WebRTC applications

---

## 📊 Project Stats

- **Lines of Code:** 2,000+
- **Components:** 6 React pages
- **API Endpoints:** 8
- **Gesture Types:** 6
- **ML Accuracy:** 94.46%
- **Training Images:** 87,000+
- **Supported Signs:** 36 (A-Z, 0-9)

---

**Made with ❤️ for the Deaf and Hard of Hearing community**

🤟 **Happy Coding!**
