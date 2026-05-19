$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

$env:PYTHONDONTWRITEBYTECODE = "1"
python -m zhilan_scraper.supabase_worker
