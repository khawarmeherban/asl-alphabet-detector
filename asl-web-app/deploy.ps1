# Automated Deployment Script for ASL Web App
# Run this after setting up Render backend

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ASL Web App - Deployment Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get backend URL from user
Write-Host "Enter your Render backend URL (e.g., https://asl-backend.onrender.com):" -ForegroundColor Yellow
$backendUrl = Read-Host

if ([string]::IsNullOrWhiteSpace($backendUrl)) {
    Write-Host "❌ Backend URL is required!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Backend URL: $backendUrl" -ForegroundColor Green
Write-Host ""

# Navigate to frontend directory
$frontendPath = Join-Path $PSScriptRoot "frontend"
Set-Location $frontendPath

# Update .env.production
Write-Host "📝 Updating .env.production..." -ForegroundColor Cyan
"REACT_APP_API_URL=$backendUrl" | Out-File -FilePath ".env.production" -Encoding UTF8
Write-Host "✅ Environment file updated" -ForegroundColor Green
Write-Host ""

# Install gh-pages if not already installed
Write-Host "📦 Checking dependencies..." -ForegroundColor Cyan
if (-not (Test-Path "node_modules/gh-pages")) {
    Write-Host "Installing gh-pages..." -ForegroundColor Yellow
    npm install gh-pages --save-dev
}
Write-Host "✅ Dependencies ready" -ForegroundColor Green
Write-Host ""

# Build and deploy
Write-Host "🚀 Building and deploying to GitHub Pages..." -ForegroundColor Cyan
Write-Host "This may take a few minutes..." -ForegroundColor Yellow
Write-Host ""

npm run deploy

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  ✅ DEPLOYMENT SUCCESSFUL!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "🌐 Your live URLs:" -ForegroundColor Cyan
    Write-Host "   Frontend: https://khawarmeherban.github.io/asl-web-app/" -ForegroundColor White
    Write-Host "   Backend:  $backendUrl" -ForegroundColor White
    Write-Host ""
    Write-Host "🎉 Your ASL app is now LIVE and accessible to everyone!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📝 Next steps:" -ForegroundColor Yellow
    Write-Host "   1. Wait 2-3 minutes for GitHub Pages to activate"
    Write-Host "   2. Visit your live site"
    Write-Host "   3. Share with friends!"
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    Write-Host "Check the error messages above." -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
