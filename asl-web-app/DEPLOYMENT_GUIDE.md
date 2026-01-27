# Deployment Guide - ASL Web App

## 🌐 Free Deployment Strategy

Deploy your project live using:
- **Frontend**: GitHub Pages (React static files)
- **Backend**: Render.com (Flask API)

Both are 100% free with these limitations:
- Render free tier sleeps after 15 min inactivity (30-60s wake time)
- GitHub Pages for public repos only

---

## Step 1: Deploy Backend to Render.com

### 1. Sign Up & Connect Repository
    "build": "react-scripts build"
  }
}
```

**3. Update API URL:**

Create `.env.production` file in frontend directory:

```env
REACT_APP_API_URL=https://your-backend-url.onrender.com
```

### 1. Sign Up & Connect Repository

1. Go to [render.com](https://render.com) and sign up with GitHub
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository: `khawarmeherban/asl-alphabet-detector`

### 2. Configure Service

Set these values:
- **Name**: `asl-backend` (or any name you prefer)
- **Root Directory**: `asl-web-app/backend`
- **Environment**: Python 3
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `gunicorn --worker-class eventlet -w 1 app:app --bind 0.0.0.0:$PORT`
- **Plan**: Free

### 3. Add Environment Variable (Optional)

Click "Advanced" and add:
- **Key**: `PYTHON_VERSION`
- **Value**: `3.11.0`

### 4. Deploy

1. Click **"Create Web Service"**
2. Wait 5-10 minutes for first deployment
3. Copy your backend URL: `https://asl-backend-xxxx.onrender.com`

**Important:** Free tier sleeps after 15 min of inactivity. First request takes 30-60s to wake up.

---

## Step 2: Deploy Frontend to GitHub Pages

### 1. Update Backend URL

Edit `asl-web-app/frontend/.env.production`:

```bash
REACT_APP_API_URL=https://your-backend-url.onrender.com
```

Replace with your actual Render URL from Step 1.

### 2. Deploy to GitHub Pages

```bash
cd asl-web-app/frontend
npm install
npm run deploy
```

This builds the React app and pushes to `gh-pages` branch.

### 3. Enable GitHub Pages

1. Go to: https://github.com/khawarmeherban/asl-alphabet-detector/settings/pages
2. **Source**: Select `gh-pages` branch
3. Click **Save**
4. Wait 2-3 minutes

### 4. Access Your Live App! 🎉

**Frontend URL:** https://khawarmeherban.github.io/asl-web-app/

---

## Troubleshooting

### Backend Issues

**Problem:** Model not found error  
**Solution:** Upload `asl_model.pkl` to Render (use environment variable for path or include in repo)

**Problem:** CORS errors  
**Solution:** Check CORS origins in `app.py` include your GitHub Pages URL

**Problem:** 502 Bad Gateway  
**Solution:** Check Render logs, ensure gunicorn command is correct

### Frontend Issues

**Problem:** Blank page after deployment  
**Solution:** Verify `homepage` in `package.json` matches your GitHub Pages URL

**Problem:** API calls failing  
**Solution:** Check `.env.production` has correct backend URL and HTTPS (not HTTP)

**Problem:** 404 on refresh  
**Solution:** GitHub Pages doesn't support client-side routing by default (known limitation)

---

## Updating Your Deployment

### Update Backend
1. Push changes to GitHub
2. Render auto-deploys from `main` branch

### Update Frontend
```bash
cd asl-web-app/frontend
npm run deploy
```

---

## Cost & Limitations

### Render.com Free Tier
- ✅ 512 MB RAM
- ✅ Shared CPU
- ✅ Auto-deploy from GitHub
- ⚠️ Sleeps after 15 min inactivity
- ⚠️ 750 hours/month (enough for personal use)

### GitHub Pages
- ✅ 100 GB bandwidth/month
- ✅ Unlimited storage for code
- ✅ Free for public repos
- ⚠️ Public repos only (for free)

---

## Alternative Hosting (If Render Fails)

### Railway.app
- Similar to Render, 500 free hours/month
- Root directory: `asl-web-app/backend`
- Build: `pip install -r requirements.txt`
- Start: `gunicorn --worker-class eventlet -w 1 app:app`

### Fly.io
- 3 small VMs free
- Requires Dockerfile (more complex setup)

---

## Next Steps

1. ✅ Test your live app thoroughly
2. ✅ Share the link: `https://khawarmeherban.github.io/asl-web-app/`
3. ✅ Monitor Render logs for errors
4. ✅ Update README with live demo link

**Congratulations! Your ASL app is now live! 🚀**

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
