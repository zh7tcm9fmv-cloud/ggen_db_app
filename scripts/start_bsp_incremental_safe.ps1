# Safe BSP incremental rebuild (Playwright).
# - Keeps rankings identical to live /cal (same MsyDcEngine path).
# - RAM-capped workers (auto); checkpoints every 25; --loop resumes after crashes.
# Requires local Flask/ggen at Base (default http://127.0.0.1:5055).
# Close extra Google Chrome tabs before starting if the machine is low on RAM.

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$Published = Join-Path $Root 'data\published'
New-Item -ItemType Directory -Force -Path $Published | Out-Null

$Log = Join-Path $Published 'bsp_incremental_safe.log'
$PidFile = Join-Path $Published 'bsp_incremental_safe.pid'
$Py = (Get-Command python -ErrorAction Stop).Source
$Script = Join-Path $Root 'scripts\build_msy_rankings_dc.py'
$Base = if ($env:MSY_DC_BASE) { $env:MSY_DC_BASE } else { 'http://127.0.0.1:5055' }

Write-Host "Preflight:"
Write-Host "  Keep Flask/ggen running at $Base"
Write-Host "  Close extra Chrome windows (optional but recommended on 16GB)"
Write-Host "  Closing Cursor does not change build results"
Write-Host ""

try {
  $null = Invoke-WebRequest -Uri $Base -UseBasicParsing -TimeoutSec 5
} catch {
  Write-Host "ERROR: server not reachable at $Base — start the app first, then re-run."
  exit 1
}

if (Test-Path $PidFile) {
  $old = (Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1).Trim()
  if ($old -match '^\d+$') {
    Stop-Process -Id ([int]$old) -Force -ErrorAction SilentlyContinue
  }
}

Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -and $_.CommandLine -like '*build_msy_rankings_dc.py*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

Start-Sleep -Seconds 2

$inner = @"
`$ErrorActionPreference = 'Continue'
Set-Location '$Root'
`$env:PYTHONUNBUFFERED = '1'
`$stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
Add-Content -Path '$Log' -Value "`n=== detached BSP incremental safe start `$stamp ===`n" -Encoding utf8
& '$Py' -u '$Script' --base '$Base' --incremental --loop --checkpoint 25 --workers 0 *>> '$Log' 2>&1
"@

$p = Start-Process -FilePath 'powershell.exe' `
  -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-Command', $inner) `
  -WorkingDirectory $Root `
  -WindowStyle Hidden `
  -PassThru

Set-Content -Path $PidFile -Value $p.Id -Encoding ascii
Write-Host "BSP incremental safe detached PID=$($p.Id)"
Write-Host "Base: $Base"
Write-Host "Log: $Log"
Write-Host "Stop later: Stop-Process -Id $($p.Id) -Force"
