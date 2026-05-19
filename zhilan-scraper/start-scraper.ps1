$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

$env:PYTHONDONTWRITEBYTECODE = "1"
python -m uvicorn zhilan_scraper.app:app --host 127.0.0.1 --port 8787
