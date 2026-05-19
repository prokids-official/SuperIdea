$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

$cmd = "cd /d `"$PSScriptRoot`" && set PYTHONDONTWRITEBYTECODE=1 && python -B -m zhilan_scraper.supabase_worker --interval 2.5 >> worker.out.log 2>> worker.err.log"
& $env:ComSpec /c start "zhilan-worker" /min $env:ComSpec /c $cmd

Write-Host "Started zhilan Supabase worker in a minimized cmd window."
Write-Host "stdout: $(Join-Path $PSScriptRoot 'worker.out.log')"
Write-Host "stderr: $(Join-Path $PSScriptRoot 'worker.err.log')"
