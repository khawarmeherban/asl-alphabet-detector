# Quick Reference - ASL Web App

## 🚀 Start Commands

### Development Mode
```bash
# Terminal 1 - Backend
cd asl-web-app/backend
python app.py

# Terminal 2 - Frontend  
cd asl-web-app/frontend
npm start
```

### URLs
- Frontend: http://localhost:3001
- Backend API: http://localhost:5000
- Health Check: http://localhost:5000/health

---

## 🎯 Key Features

| Feature | Endpoint/Page | Description |
|---------|---------------|-------------|
| Live Detection | `/detection` | Real-time ASL recognition |
| Communication | `/bidirectional` | ASL + Voice together |
| Analytics | `/analytics` | Usage statistics |
| History | `/history` | Conversation logs |

---

## 🔧 Configuration

### Backend (app.py)
```python
MODEL_PATH = '../../data/asl_model.pkl'  # Change model location
MAX_HISTORY = 500  # History size limit
PREDICTION_THROTTLE = 100  # ms between predictions
```

### Frontend (LiveDetection.js)
```javascript
const API_URL = 'http://localhost:5000';  // Backend URL
const PREDICTION_THROTTLE = 100;  // ms throttle
```

---

## 🐛 Troubleshooting

### Backend Not Starting
```bash
# Check if model exists
ls ../../data/asl_model.pkl

# Train model if missing
cd ../../
python inference_classifier.py
```

### Port Already in Use
```bash
# Kill process on port 5000
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Or use different port
$env:PORT=3002; npm start
```

### Camera Not Working
1. Check browser permissions
2. Use Chrome/Edge (not Firefox)
3. Ensure only one tab uses camera

### CORS Errors
- Ensure backend on port 5000
- Frontend on 3000, 3001, or 3002
- Check CORS settings in app.py

---

## 📊 Performance

### Optimizations Enabled:
- ✅ Prediction caching (100 items)
- ✅ Request throttling (100ms)
- ✅ Memory limits (500 history)
- ✅ Thread-safe TTS
- ✅ 60 FPS canvas rendering

### Expected Metrics:
- Prediction: ~50ms
- Canvas: 60 FPS
- Memory: <200MB frontend, <500MB backend

---

## 🔑 Keyboard Shortcuts

### Live Detection:
- Space: Add space to text
- Enter: New line
- Backspace: Delete last char

### Bidirectional:
- M: Toggle microphone
- R: Read text aloud

---

## 📝 API Endpoints

```bash
GET  /health           # Backend status
POST /predict          # ASL prediction
POST /predict-words    # Word suggestions
POST /speak            # Text-to-speech
GET  /history          # Get history
POST /history          # Add to history
DELETE /history        # Clear history
GET  /statistics       # Analytics data
```

---

## 🛠️ Development

### Install Dependencies:
```bash
# Backend
cd backend
pip install -r requirements.txt

# Frontend
cd frontend
npm install
```

### Build for Production:
```bash
# Frontend
npm run build

# Backend
pip install gunicorn
gunicorn -w 4 app:app
```

---

## 📚 Tech Stack

**Frontend:** React 18, TailwindCSS, MediaPipe, Recharts  
**Backend:** Flask, SocketIO, Scikit-learn, pyttsx3  
**ML:** Random Forest (94.46% accuracy)

---

## ✨ Quick Tips

1. **Better Accuracy:** Hold signs steady for 2 seconds
2. **Faster Typing:** Use word suggestions
3. **Clear Background:** Better hand detection
4. **Good Lighting:** Improves confidence scores
5. **Single Hand:** More accurate than two hands

---

Created: Jan 2026 | Version: 1.0
