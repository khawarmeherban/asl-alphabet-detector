# ASL Web Application

Full-stack React.js + Flask application for ASL recognition and communication.

## 🌐 Live Demo

**Coming Soon:** Deploy your own version for free! See [DEPLOY_QUICK.md](DEPLOY_QUICK.md)

## Project Structure

```
asl-web-app/
├── frontend/          # React.js application
│   ├── public/
│   ├── src/
│   └── package.json
├── backend/           # Flask API server
│   ├── app.py
│   ├── model_handler.py
│   └── requirements.txt
└── README.md
```

## Features

- Live ASL Detection with Webcam
- Real-time Translation
- Speech-to-Text & Text-to-Speech
- Word Prediction & Auto-Complete
- Conversation History
- Analytics Dashboard
- Video Recording
- Multi-language Support

## Setup Instructions

### Backend Setup (Flask)

1. Navigate to backend:
```bash
cd backend
pip install -r requirements.txt
python app.py
```

Backend runs on: http://localhost:5000

### Frontend Setup (React)

1. Navigate to frontend:
```bash
cd frontend
npm install
npm start
```

Frontend runs on: http://localhost:3000

## Usage

Open http://localhost:3000 in your browser after starting both servers.

## 🚀 Deploy to Production (FREE)

Want to make your project accessible online for free? See:
- **[Quick Deploy Guide](DEPLOY_QUICK.md)** - Step-by-step (5 minutes)
- **[Complete Deployment Guide](DEPLOYMENT_GUIDE.md)** - All options explained

### Quick Deploy:
```bash
# 1. Deploy backend to Render.com (free)
# 2. Run this script:
cd asl-web-app
./deploy.ps1
```

Your app will be live at: `https://khawarmeherban.github.io/asl-web-app/`

## Technologies

- **Frontend**: React.js, TailwindCSS, MediaPipe, React Router
- **Backend**: Flask, Flask-CORS, Flask-SocketIO
- **ML**: Scikit-learn, MediaPipe, NumPy
