# Instructions to deploy backend on Hugging Face Spaces

1. Ensure the trained model file `asl_model.pkl` is present in the backend directory. If not, copy it from the data folder:
   - On Windows (PowerShell):
     ```
     ./copy_model.ps1
     ```
   - On Linux/macOS:
     ```
     bash copy_model.sh
     ```
2. Make sure your `.gitignore` does NOT exclude `.pkl` files so the model is pushed.
3. Add, commit, and push all files to your Hugging Face Space:
   ```
   git add .
   git commit -m "Fix deployment: ensure model and prod settings"
   git push origin main
   ```
4. Your Space will build and deploy. Check the Logs tab for errors.

---

- The backend now uses gunicorn+eventlet for production and WebSocket support.
- The root endpoint `/` returns a health check for Hugging Face readiness.
- The model file is included for deployment.
- The Procfile and Dockerfile are set for port 7860.

If you see errors, check the build logs and share them for help!
