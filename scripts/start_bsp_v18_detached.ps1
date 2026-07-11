# Start BSP v18 full-catalog rebuild detached (SSR+ lower always SSP stats).
# Survives IDE close. Logs to data/published/bsp_v18_detached.log
# Requires local Flask at http://127.0.0.1:5055 serving the fixed JS.
# Resume from last checkpoint; auto-loop on crash.

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$Published = Join-Path $Root 'data\published'
New-Item -ItemType Directory -Force -Path $Published | Out-Null

$Log = Join-Path $Published 'bsp_v18_detached.log'
$PidFile = Join-Path $Published 'bsp_v18_detached.pid'
$Py = (Get-Command python -ErrorAction Stop).Source
$Script = Join-Path $Root 'scripts\build_msy_rankings_dc.py'
$Base = if ($env:MSY_DC_BASE) { $env:MSY_DC_BASE } else { 'http://127.0.0.1:5055' }

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
`$env:BSP_PUBLISHED_CACHE_TAG = '_v18_bsp_dc'
`$stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
Add-Content -Path '$Log' -Value "`n=== detached BSP v18 full-catalog start `$stamp ===`n" -Encoding utf8
& '$Py' -u '$Script' --base '$Base' --loop --workers 3 --checkpoint 10 *>> '$Log' 2>&1
"@

$p = Start-Process -FilePath 'powershell.exe' `
  -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-Command', $inner) `
  -WorkingDirectory $Root `
  -WindowStyle Hidden `
  -PassThru

Set-Content -Path $PidFile -Value $p.Id -Encoding ascii
Write-Host "BSP v18 full-catalog detached PID=$($p.Id) (survives Cursor close)"
Write-Host "Base: $Base"
Write-Host "Log: $Log"
Write-Host "PID file: $PidFile"
Write-Host "Stop later: Stop-Process -Id $($p.Id) -Force"
