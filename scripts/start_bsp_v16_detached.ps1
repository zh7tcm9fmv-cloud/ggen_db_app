# Start BSP v16 full-catalog rebuild detached from Cursor / this shell.
# Survives IDE close. Logs to data/published/bsp_v16_detached.log
# Resume from last checkpoint; auto-loop on crash.

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$Published = Join-Path $Root 'data\published'
New-Item -ItemType Directory -Force -Path $Published | Out-Null

$Log = Join-Path $Published 'bsp_v16_detached.log'
$PidFile = Join-Path $Published 'bsp_v16_detached.pid'
$Py = (Get-Command python -ErrorAction Stop).Source
$Script = Join-Path $Root 'scripts\build_msy_rankings_dc.py'

# Stop any prior detached build recorded in pid file
if (Test-Path $PidFile) {
  $old = (Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1).Trim()
  if ($old -match '^\d+$') {
    Stop-Process -Id ([int]$old) -Force -ErrorAction SilentlyContinue
  }
}

# Also kill any leftover build_msy_rankings_dc.py processes
Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -and $_.CommandLine -like '*build_msy_rankings_dc.py*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

Start-Sleep -Seconds 2

# Nested powershell so this survives Cursor/agent terminal teardown.
# PYTHONUNBUFFERED + append log (stdout+stderr).
$inner = @"
`$ErrorActionPreference = 'Continue'
Set-Location '$Root'
`$env:PYTHONUNBUFFERED = '1'
`$stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
Add-Content -Path '$Log' -Value "`n=== detached BSP start `$stamp ===`n" -Encoding utf8
& '$Py' -u '$Script' --loop --workers 3 --checkpoint 10 *>> '$Log' 2>&1
"@

$p = Start-Process -FilePath 'powershell.exe' `
  -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-Command', $inner) `
  -WorkingDirectory $Root `
  -WindowStyle Hidden `
  -PassThru

Set-Content -Path $PidFile -Value $p.Id -Encoding ascii
Write-Host "BSP v16 detached PID=$($p.Id) (survives Cursor close)"
Write-Host "Log: $Log"
Write-Host "PID file: $PidFile"
Write-Host "Stop later: Stop-Process -Id $($p.Id) -Force"
