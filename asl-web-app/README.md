# ASL Web Application

Full-stack React.js + Flask application for real-time American Sign Language recognition.

## 🌐 Live Demo

**Frontend:** https://khawarmeherban.github.io/asl-web-app/  
**Backend:** Deploy your own to Render.com (see [DEPLOY_QUICK.md](DEPLOY_QUICK.md))

## 🚀 Features

- **Live ASL Detection**: Real-time hand sign recognition with webcam (94.46% accuracy)
- **Bidirectional Communication**: ASL-to-text and voice-to-text modes
- **Word Prediction**: Smart suggestions from 23 common words
- **Text-to-Speech**: Hear detected text spoken aloud
- **Analytics Dashboard**: Letter frequency and usage statistics
- **Conversation History**: Save and browse up to 500 interactions

## 📁 Project Structure

```
asl-web-app/
├── frontend/              # React.js 18 application
│   ├── src/
│   │   ├── pages/        # 5 pages: Home, Detection, Bidirectional, Analytics, History
│   │   ├── App.js
│   │   └── index.js
│   └── package.json
├── backend/              # Flask 3.0 API server
│   ├── app.py           # 8 endpoints
│   └── requirements.txt
└── README.md
```

## 🛠️ Tech Stack

**Frontend:** React 18, TailwindCSS, MediaPipe Hands, Recharts  
**Backend:** Flask, Scikit-learn (Random Forest), MediaPipe, pyttsx3  
**Deployment:** GitHub Pages + Render.com (Free tiers)
## ⚙️ Local Development Setup

### Prerequisites
- Python 3.8+
- Node.js 16+
- Webcam
- Trained ML model at `../../data/asl_model.pkl`

### Backend Setup

```bash
cd asl-web-app/backend
pip install -r requirements.txt
python app.py
```

Backend runs on **http://localhost:5000**

### Frontend Setup

```bash
cd asl-web-app/frontend
npm install
npm start
```

Frontend runs on **http://localhost:3000**

Open http://localhost:3000 to use the application.

## 🌐 Deploy to Production (FREE)

Deploy your own live version in 10 minutes:

1. **Backend to Render.com**: See [DEPLOY_QUICK.md](DEPLOY_QUICK.md)
2. **Frontend to GitHub Pages**: `npm run deploy` in frontend folder

## 📡 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Server health check |
| `/predict` | POST | ASL prediction from landmarks |
| `/predict-words` | POST | Word suggestions |
| `/speak` | POST | Text-to-speech |
| `/history` | GET/POST/DELETE | Conversation history |
| `/statistics` | GET | Usage analytics |

## 🎯 Usage Guide

1. **Live Detection**: Click "Start Detection" and show ASL signs to webcam
2. **Voice Mode**: Click microphone icon and speak
3. **Word Suggestions**: Click predicted words to auto-complete
4. **Text-to-Speech**: Click "Speak" button to hear output
5. **Analytics**: View letter frequency and conversation stats
6. **History**: Browse saved conversations and filter by mode

## 📖 Documentation

- **[DEPLOY_QUICK.md](DEPLOY_QUICK.md)** - Quick deployment (10 min)
- **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** - Complete guide
- **[SETUP_GUIDE.md](SETUP_GUIDE.md)** - Setup & troubleshooting

## 🐛 Troubleshooting

**Backend won't start:** Ensure ML model exists at `../../data/asl_model.pkl`  
**Webcam not working:** Check browser camera permissions  
**CORS errors:** Backend on port 5000, frontend on 3000  
**Speech fails:** Use Chrome/Edge (Web Speech API)

## 📝 License

MIT License - Free for educational use

## 👨‍💻 Developer

GitHub: [khawarmeherban/asl-alphabet-detector](https://github.com/khawarmeherban/asl-alphabet-detector)

---

**Happy Coding! 🤟**
