# ASL Alphabet Detector - Complete Guide

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Node.js 14+
- Webcam
- Modern browser (Chrome/Edge recommended)

### Setup & Run
```bash
# Backend
cd asl-web-app/backend
pip install -r requirements.txt
python app.py

# Frontend (new terminal)
cd asl-web-app/frontend
npm install
npm start
```

Visit: **http://localhost:3000**

---

## 📋 Features

### 1. **Live ASL Detection**
- Real-time hand tracking with MediaPipe
- Letter/number recognition
- Color-coded confidence meter (Green/Yellow/Red)
- Auto-stabilization (8-frame buffer)

### 2. **Text-to-Speech**
- Browser-based speech synthesis
- Toggle ON/OFF control
- Slow, clear voice (0.8x speed)
- Works offline

### 3. **Word Builder**
- Auto letter accumulation
- Space/Backspace/Clear controls
- Character & word counter
- Real-time display

### 4. **Additional Features**
- Conversation history
- Word suggestions
- Analytics dashboard
- Bidirectional translation
- Gesture controls

---

## 🎯 Usage

### Basic Workflow
1. **Start Detection** → Camera activates
2. **Show ASL Signs** → Letters detected
3. **Check Confidence** → Green = accurate
4. **Build Sentence** → Auto-accumulates
5. **Speak/Save** → Output results

---

## 🎨 UI Components

### Confidence Meter
- **Green (80-100%)**: High confidence
- **Yellow (50-79%)**: Medium confidence  
- **Red (0-49%)**: Low confidence

### Tips for Better Detection
- Good lighting
- Centered hand position
- Hold steady 2-3 seconds
- Clear ASL signs

---

## 🔧 Configuration

### Backend (app.py)
```python
MODEL_PATH = 'path/to/asl_model.pkl'
PORT = 5000
HOST = '0.0.0.0'
```

### Frontend (.env)
```env
REACT_APP_API_URL=http://localhost:5000
```

---

## 🐛 Troubleshooting

### Backend Not Starting
```bash
# Check port availability
netstat -ano | findstr "5000"

# Restart backend
python app.py
```

### Model Not Loading
- Verify `data/asl_model.pkl` exists
- Retrain if corrupted: `python process_dataset.py`

### Camera Not Working
- Allow browser permissions
- Close other apps using camera
- Use Chrome/Edge browser

### Low Accuracy
- Improve lighting
- Center hand in frame
- Hold signs steady

---

## 📁 Project Structure

```
asl-web-app/
├── backend/
│   ├── app.py              # Flask server
│   ├── requirements.txt    # Python deps
│   └── start_backend.bat   # Windows launcher
├── frontend/
│   ├── src/
│   │   ├── pages/          # React components
│   │   ├── App.js          # Main app
│   │   └── index.css       # Styles
│   ├── public/
│   └── package.json        # Node deps
└── data/
    └── asl_model.pkl       # ML model
```

---

**Built with ❤️ for accessibility and education**
