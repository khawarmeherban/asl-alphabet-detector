# ASL Web Application - Complete Setup Guide

## 🚀 Quick Start

### Backend Setup (Flask API)

1. **Navigate to backend directory:**
```powershell
cd asl-web-app/backend
```

2. **Install Python dependencies:**
```powershell
pip install -r requirements.txt
```

3. **Start the Flask server:**
```powershell
python app.py
```

Backend will run on: **http://localhost:5000**

---

### Frontend Setup (React)

1. **Navigate to frontend directory:**
```powershell
cd asl-web-app/frontend
```

2. **Install Node.js dependencies:**
```powershell
npm install
```

3. **Start the React development server:**
```powershell
npm start
```

Frontend will run on: **http://localhost:3000**

---

## 📋 Prerequisites

- Python 3.8+
- Node.js 16+
- npm or yarn
- Webcam (for ASL detection)
- Microphone (for voice recognition)
- Trained ML model: `data/asl_model.pkl` (in root directory)

---

## 🎯 Features

### ✅ Implemented Features

1. **Live ASL Detection**
   - Real-time hand sign recognition
   - MediaPipe 21-point hand tracking
   - 94.46% accuracy Random Forest model
   - Confidence scoring for predictions
   - Auto-space insertion after 4 letters

2. **Bidirectional Communication**
   - ASL to text conversion (MediaPipe)
   - Voice to text (Web Speech API)
   - Text-to-speech output (pyttsx3)
   - Switch between ASL and Voice modes

3. **Word Prediction**
   - Smart word suggestions from common words
   - Predictions based on partial text input
   - 23 common words database

4. **Analytics Dashboard**
   - Letter frequency bar chart
   - Message type pie chart (ASL vs Voice)
   - Total conversation statistics
   - Real-time data visualization

5. **Conversation History**
   - Save all interactions (max 500)
   - Filter by mode (ASL/Voice)
   - View conversation details
   - Clear history option

---

## 🏗️ Project Structure

```
asl-web-app/
├── backend/
│   ├── app.py                 # Flask API server
│   ├── requirements.txt       # Python dependencies
│   └── README.md
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── pages/
│   │   │   ├── HomePage.js
│   │   │   ├── LiveDetection.js
│   │   │   ├── BidirectionalPage.js
│   │   │   ├── AnalyticsPage.js
│   │   │   └── HistoryPage.js
│   │   ├── App.js
│   │   ├── index.js
│   │   └── index.css
│   ├── package.json
│   ├── tailwind.config.js
│   └── postcss.config.js
└── README.md
```

---

## 🔧 Configuration

### Backend API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/predict` | POST | ASL prediction |
| `/predict-words` | POST | Word suggestions |
| `/speak` | POST | Text-to-speech |
| `/history` | GET/POST/DELETE | Conversation history |
| `/statistics` | GET | Usage analytics |

### Environment Variables (Optional)

Create `.env` file in backend directory:

```env
FLASK_ENV=development
FLASK_DEBUG=True
MODEL_PATH=../../data/asl_model.pkl
```

---

## 🎨 Tech Stack

### Frontend
- React.js 18
- React Router v6
- TailwindCSS
- MediaPipe Hands
- Recharts (analytics)
- Lucide React (icons)
- Axios (HTTP client)
- Socket.IO (WebSocket)

### Backend
- Flask 3.0
- Flask-CORS
- Flask-SocketIO
- Scikit-learn
- MediaPipe
- OpenCV
- NumPy
- pyttsx3 (TTS)

---

## 🚨 Troubleshooting

### Issue: Backend won't start
**Solution:** Make sure the ML model exists at `../../data/asl_model.pkl`

```powershell
# Train the model first
cd ../../
python inference_classifier.py
```

### Issue: Webcam not detected
**Solution:** Check browser permissions and allow camera access

### Issue: CORS errors
**Solution:** Make sure backend is running on port 5000 and frontend on 3000

### Issue: Speech recognition not working
**Solution:** Chrome/Edge browser required for Web Speech API

### Issue: npm install fails
**Solution:** Clear cache and retry

```powershell
npm cache clean --force
npm install
```

---

## 📱 Browser Support

- Chrome 90+ (Recommended)
- Edge 90+
- Firefox 88+ (limited speech recognition)
- Safari 14+ (limited features)

---

## 🎯 Usage Guide

### 1. Live Detection Page
- Click "Start Detection"
- Show ASL signs to webcam
- Watch text auto-complete
- Use word suggestions
- Click "Speak Text" to hear output

### 2. Bidirectional Communication
- **ASL Mode:** Start detection and sign
- **Voice Mode:** Click microphone and speak
- Use both modes simultaneously
- Save conversations to history

### 3. Analytics Dashboard
- View message statistics
- See letter frequency charts
- Track usage patterns
- Monitor performance

### 4. History Page
- Browse all conversations
- Filter by mode (ASL/Voice)
- Playback messages
- Clear or export data

---

## 🔮 Future Enhancements

- [ ] Sentence-level ASL recognition (beyond single letters)
- [ ] Deep learning model (CNN/LSTM for better accuracy)
- [ ] Database integration (PostgreSQL for persistent history)
- [ ] User authentication and profiles
- [ ] Export conversation history (PDF/CSV)
- [ ] Mobile responsive design improvements
- [ ] Real-time collaboration (multiple users)
- [ ] Custom word dictionary additions

---

## 📄 License

MIT License - Feel free to use for educational purposes

---

## 👨‍💻 Developer

Created as part of ASL Communication System project

GitHub: [khawarmeherban/asl-alphabet-detector](https://github.com/khawarmeherban/asl-alphabet-detector)

---

## 🆘 Support

For issues or questions, please open an issue on GitHub or contact support.

---

**Happy Coding! 🤟**
