$Limit = 5
if ($args.Count -ge 1) {
  $Limit = [int]$args[0]
}

$ErrorActionPreference = "Stop"
if (Get-Variable PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
  $PSNativeCommandUseErrorActionPreference = $false
}

Set-Location $PSScriptRoot

$logDir = Join-Path $PSScriptRoot "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logFile = Join-Path $logDir "daily-sync-$stamp.log"

$env:PYTHONDONTWRITEBYTECODE = "1"

"[$(Get-Date -Format o)] Start AI daily sync" | Tee-Object -FilePath $logFile
python -B -m zhilan_scraper.daily_productizer --limit $Limit *>&1 | Tee-Object -FilePath $logFile -Append
$exitCode = $LASTEXITCODE
"[$(Get-Date -Format o)] Finished AI daily sync with exit code $exitCode" | Tee-Object -FilePath $logFile -Append

exit $exitCode
