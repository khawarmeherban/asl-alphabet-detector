@echo off
echo ========================================
echo   HandSense ASL Detector - Backend
echo ========================================
echo.
echo Starting Flask Backend on port 5000...
start "Flask Backend" cmd /k "cd /d %~dp0backend && python app.py"
timeout /t 5 /nobreak >nul
echo.
echo Starting ngrok tunnel...
start "ngrok Tunnel" cmd /k "ngrok http 5000"
echo.
echo ========================================
echo   ✅ Backend services started!
echo ========================================
echo.
echo 📋 Next Steps:
echo   1. Copy the ngrok HTTPS URL from the ngrok window
echo   2. Update asl-web-app/frontend/.env with the ngrok URL
echo   3. Rebuild frontend: cd frontend && npm run build
echo   4. Deploy to Netlify
echo.
echo Press any key to exit...
pause >nul
