# Free Deployment Guide - ASL Web App

## 🌐 Deploy Your Project Live for FREE

You can host this project online for free using GitHub Pages (frontend) and Render/Railway (backend).

---

## Option 1: GitHub Pages + Render (Recommended) ⭐

### Part A: Deploy Frontend to GitHub Pages

**1. Prepare React for GitHub Pages:**

```bash
cd asl-web-app/frontend
npm install gh-pages --save-dev
```

**2. Update `package.json`:**

Add these lines to your `package.json`:

```json
{
  "homepage": "https://khawarmeherban.github.io/asl-web-app",
  "scripts": {
    "predeploy": "npm run build",
    "deploy": "gh-pages -d build",
    "start": "react-scripts start",
    "build": "react-scripts build"
  }
}
```

**3. Update API URL:**

Create `.env.production` file in frontend directory:

```env
REACT_APP_API_URL=https://your-backend-url.onrender.com
```

Update `LiveDetection.js` and other pages:

```javascript
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
```

**4. Deploy to GitHub Pages:**

```bash
cd asl-web-app/frontend
npm run deploy
```

**5. Enable GitHub Pages:**

1. Go to your repo: `https://github.com/khawarmeherban/asl-alphabet-detector`
2. Settings → Pages
3. Source: `gh-pages` branch
4. Save

**Live URL:** `https://khawarmeherban.github.io/asl-web-app/`

---

### Part B: Deploy Backend to Render.com (Free Forever)

**1. Create `requirements.txt` for production:**

```bash
cd asl-web-app/backend
```

Update `requirements.txt`:

```txt
flask>=3.0.0
flask-cors>=4.0.0
flask-socketio>=5.3.5
python-socketio>=5.10.0
numpy<2.0.0
scikit-learn>=1.3.2
mediapipe>=0.10.9
opencv-python-headless>=4.9.0.80
Pillow>=10.0.0
gunicorn>=21.2.0
eventlet>=0.33.3
```

**2. Create `Procfile`:**

```bash
# In backend directory
echo "web: gunicorn --worker-class eventlet -w 1 app:app" > Procfile
```

**3. Create `render.yaml`:**

```yaml
services:
  - type: web
    name: asl-backend
    env: python
    buildCommand: pip install -r requirements.txt
    startCommand: gunicorn --worker-class eventlet -w 1 app:app
    envVars:
      - key: PYTHON_VERSION
        value: 3.11.0
```

**4. Deploy to Render:**

1. Go to [render.com](https://render.com) and sign up (free)
2. Click "New +" → "Web Service"
3. Connect your GitHub repo: `khawarmeherban/asl-alphabet-detector`
4. Configure:
   - **Name:** asl-backend
   - **Root Directory:** `asl-web-app/backend`
   - **Environment:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn --worker-class eventlet -w 1 app:app`
5. Click "Create Web Service"

**Your backend URL:** `https://asl-backend.onrender.com`

**5. Update CORS in `app.py`:**

```python
CORS(app, origins=[
    'https://khawarmeherban.github.io',
    'http://localhost:3000',
    'http://localhost:3001'
])
```

**6. Commit and push:**

```bash
git add .
git commit -m "Deploy to Render"
git push origin main
```

Render will auto-deploy!

---

## Option 2: Netlify + Railway (Alternative)

### Frontend: Netlify (Free)

**1. Build your app:**

```bash
cd asl-web-app/frontend
npm run build
```

**2. Deploy to Netlify:**

1. Go to [netlify.com](https://netlify.com)
2. Drag & drop the `build` folder
3. Or connect GitHub repo for auto-deploy

**3. Configure environment:**

- Settings → Build & Deploy → Environment
- Add: `REACT_APP_API_URL=https://your-railway-backend.up.railway.app`

---

### Backend: Railway (Free $5/month credit)

**1. Go to [railway.app](https://railway.app)**

**2. Click "Start a New Project"**

**3. Deploy from GitHub:**

- Connect repo: `khawarmeherban/asl-alphabet-detector`
- Root directory: `asl-web-app/backend`

**4. Add environment variables:**

```
PYTHON_VERSION=3.11
MODEL_PATH=/app/data/asl_model.pkl
```

**5. Railway auto-detects Python and deploys!**

---

## Option 3: Vercel + PythonAnywhere

### Frontend: Vercel (Free)

```bash
cd asl-web-app/frontend
npm install -g vercel
vercel
```

Follow prompts, it auto-deploys!

### Backend: PythonAnywhere (Free)

1. Sign up at [pythonanywhere.com](https://pythonanywhere.com)
2. Upload backend code
3. Configure WSGI file
4. Free subdomain: `yourusername.pythonanywhere.com`

---

## 📦 Complete Deployment Commands

### One-Time Setup:

```bash
# 1. Navigate to project root
cd "d:\projects\python\AI Projects\New folder"

# 2. Add to GitHub (if not already)
git add .
git commit -m "Prepare for deployment"
git push origin main

# 3. Deploy Frontend to GitHub Pages
cd asl-web-app/frontend
npm install gh-pages --save-dev
npm run deploy

# 4. Backend to Render
# (Use Render dashboard - see Part B above)
```

---

## 🔒 Important Notes

### 1. **Model File Warning:**

Your `asl_model.pkl` file is large and may exceed free tier limits. Options:

**Option A:** Upload to GitHub (if <100MB):
```bash
git lfs install
git lfs track "*.pkl"
git add .gitattributes
git add data/asl_model.pkl
git commit -m "Add model with LFS"
```

**Option B:** Host model separately:
- Upload to Google Drive
- Use Dropbox direct link
- Store on cloud storage (S3, GCS)

**Option C:** Retrain model on server:
- Include training script
- Auto-train on first deployment

### 2. **Free Tier Limitations:**

| Platform | CPU | Memory | Bandwidth | Sleep |
|----------|-----|--------|-----------|-------|
| Render | 0.1 CPU | 512MB | 100GB/mo | After 15 min idle |
| Railway | Shared | 512MB | 100GB/mo | $5 credit/mo |
| Netlify | N/A | N/A | 100GB/mo | Never |
| GitHub Pages | N/A | N/A | 100GB/mo | Never |

### 3. **Render Auto-Sleep:**

Free Render apps sleep after 15 minutes. First request takes 30-60 seconds to wake up.

**Solution:** Use [UptimeRobot](https://uptimerobot.com) (free) to ping your app every 5 minutes.

---

## 🎯 Quick Deployment Checklist

- [ ] Update `package.json` with homepage
- [ ] Create `.env.production` with backend URL
- [ ] Update CORS in `app.py`
- [ ] Add `Procfile` for Render
- [ ] Update `requirements.txt`
- [ ] Commit and push to GitHub
- [ ] Deploy frontend to GitHub Pages
- [ ] Deploy backend to Render
- [ ] Update frontend API_URL to backend URL
- [ ] Test live deployment
- [ ] Set up UptimeRobot (optional)

---

## 🌟 After Deployment

**Your live URLs:**

- **Frontend:** `https://khawarmeherban.github.io/asl-web-app/`
- **Backend:** `https://asl-backend.onrender.com`
- **Repo:** `https://github.com/khawarmeherban/asl-alphabet-detector`

**Share your project:**

```markdown
## 🌐 Live Demo
👉 [Try ASL Detector Live](https://khawarmeherban.github.io/asl-web-app/)

## 📱 Features
- Real-time ASL recognition
- Voice & sign communication
- Analytics dashboard
- Free & open source!
```

---

## 💡 Pro Tips

1. **Add README badge:**
```markdown
![Deploy Status](https://img.shields.io/badge/deploy-live-brightgreen)
```

2. **Custom Domain (Free):**
   - GitHub Pages supports custom domains
   - Get free domain from [Freenom](https://freenom.com)
   - Add CNAME file to `public/` folder

3. **Analytics:**
   - Add Google Analytics (free)
   - Track usage and visitors

4. **SEO:**
   - Add meta tags in `public/index.html`
   - Create `sitemap.xml`
   - Submit to Google Search Console

---

## 🚨 Troubleshooting Deployment

### Issue: Build fails on Render
```bash
# Check Python version
python --version

# Ensure requirements.txt has correct versions
pip freeze > requirements.txt
```

### Issue: Frontend can't connect to backend
- Check CORS settings
- Verify backend URL in `.env.production`
- Check browser console for errors

### Issue: Model not loading on Render
- Upload model separately
- Use environment variable for model path
- Check file size limits

---

**Ready to deploy?** Start with Option 1 (GitHub Pages + Render) - it's the easiest! 🚀
