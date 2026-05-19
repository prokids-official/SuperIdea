$ErrorActionPreference = "Stop"

$taskName = "Zhilan AI Daily Sync"
$scriptPath = Join-Path $PSScriptRoot "run-daily-sync.cmd"

if (-not (Test-Path $scriptPath)) {
  throw "Cannot find $scriptPath"
}

$action = New-ScheduledTaskAction -Execute $scriptPath

$trigger = New-ScheduledTaskTrigger -Daily -At 10:00
$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 20)

$principal = New-ScheduledTaskPrincipal `
  -UserId $env:USERNAME `
  -LogonType Interactive `
  -RunLevel Limited

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Principal $principal `
  -Description "Sync imjuya/juya-ai-daily issues into Supabase every day at 10:00." `
  -Force | Out-Null

Write-Host "Installed scheduled task: $taskName"
Write-Host "Schedule: every day at 10:00 local time"
Write-Host "Script: $scriptPath"
