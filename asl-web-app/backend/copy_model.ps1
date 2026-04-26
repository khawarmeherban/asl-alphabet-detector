# Copy the trained model to backend for deployment.
$ErrorActionPreference = 'Stop'

$source = Resolve-Path -Path (Join-Path $PSScriptRoot '..\..\data\asl_model.pkl') -ErrorAction SilentlyContinue
if (-not $source) {
    Write-Error "Model not found at ../../data/asl_model.pkl. Train it first with 'python inference_classifier.py' or set ASL_MODEL_PATH in .env."
}

$destination = Join-Path $PSScriptRoot 'asl_model.pkl'
Copy-Item -LiteralPath $source.Path -Destination $destination -Force
Write-Host "Copied trained ASL model to $destination"
