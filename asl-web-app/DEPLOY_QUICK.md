## 🚀 Quick Deploy Commands

### Step 1: Deploy Backend to Render

1. Go to https://render.com and sign in with GitHub
2. Click "New +" → "Web Service"
3. Connect your repository: `khawarmeherban/asl-alphabet-detector`
4. Configure:
   - **Name:** asl-backend
   - **Root Directory:** `asl-web-app/backend`
   - **Environment:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn --worker-class eventlet -w 1 app:app`
   - **Plan:** Free
5. Click "Create Web Service"
6. Wait for deployment (5-10 minutes)
7. Copy your backend URL: `https://asl-backend.onrender.com`

### Step 2: Update Frontend with Backend URL

```bash
cd "d:\projects\python\AI Projects\New folder\asl-web-app\frontend"

# Edit .env.production file
notepad .env.production

# Change to your actual Render URL:
# REACT_APP_API_URL=https://YOUR-BACKEND-NAME.onrender.com
```

### Step 3: Deploy Frontend to GitHub Pages

```bash
cd "d:\projects\python\AI Projects\New folder\asl-web-app\frontend"

# Install gh-pages
npm install

# Deploy to GitHub Pages
npm run deploy
```

### Step 4: Enable GitHub Pages

1. Go to: https://github.com/khawarmeherban/asl-alphabet-detector/settings/pages
2. Source: Select `gh-pages` branch
3. Click Save
4. Wait 2-3 minutes

### Step 5: Visit Your Live Site! 🎉

**Frontend:** https://khawarmeherban.github.io/asl-web-app/
**Backend:** https://YOUR-BACKEND-NAME.onrender.com

---

## 🔄 Update Your Live Site

Whenever you make changes:

```bash
# Push changes to GitHub
git add .
git commit -m "Update features"
git push origin main

# Redeploy frontend
cd asl-web-app/frontend
npm run deploy
```

Render auto-deploys backend when you push to GitHub!

---

## ⚠️ Important Notes

1. **First load is slow:** Render free tier sleeps after 15 min idle. First request takes ~60 seconds.

2. **Keep alive (optional):** Use https://uptimerobot.com to ping your backend every 5 minutes.

3. **Model file:** If your model is >100MB, you'll need to:
   - Use Git LFS, or
   - Upload to cloud storage, or
   - Retrain on server

---

## 📱 Share Your Project

Add this to your GitHub README:

```markdown
## 🌐 Live Demo
👉 **[Try it live!](https://khawarmeherban.github.io/asl-web-app/)**

## 🔗 Links
- Frontend: https://khawarmeherban.github.io/asl-web-app/
- Backend: https://asl-backend.onrender.com
- Repository: https://github.com/khawarmeherban/asl-alphabet-detector
```

---

Done! Your project is now live and accessible to anyone on the internet! 🎊
