@echo off
echo ========================================
echo   HandSense ASL Detector - Backend
echo ========================================
echo.
echo Starting Flask Backend on port 5000...
start "Flask Backend" cmd /k "cd /d %~dp0backend && python app.py"
timeout /t 5 /nobreak >nul
echo.
echo ========================================
echo   ✅ Backend service started!
echo ========================================
echo.
echo 📋 Next Steps:
echo   1. Update asl-web-app/frontend/.env with your backend URL
echo   2. Rebuild frontend: cd frontend && npm run build
echo   3. Deploy to Netlify
echo.
echo Press any key to exit...
pause >nul
