# Hugging Face Spaces - ASL Backend

This backend serves the ASL Alphabet Detector web app using Flask. It provides ML model inference and real-time communication APIs.

## How to deploy on Hugging Face Spaces

1. **Clone your Space**
   ```sh
   git clone https://huggingface.co/spaces/<your-username>/<your-space-name>
   ```
2. **Copy backend files**
   Place all backend files (including `app.py`, `requirements.txt`, `Dockerfile`, and model files if needed) into the repo.
3. **Commit and push**
   ```sh
   git add .
   git commit -m "Deploy ASL backend to Hugging Face Spaces"
   git push
   ```
   Use your Hugging Face access token as password if prompted.
4. **Wait for build**
   Hugging Face will build and deploy your Space automatically.
5. **Test your Space**
   Visit your Space URL to confirm it’s running (should listen on port 7860).

## Notes
- The backend must listen on port 7860 for Spaces.
- If you use a model file (e.g., `asl_model.pkl`), ensure it is included in the repo or handled in your code.
- You can customize this README to add more details about your API endpoints, usage, or Space features.
