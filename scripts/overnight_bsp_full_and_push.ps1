# Full BSP rebuild overnight, then shards + git commit + push (Railway deploy).
# Requires local Flask on :5000. Run from repo root.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..
$env:PYTHONIOENCODING = 'utf-8'
$log = Join-Path $PSScriptRoot '..\data\persistent\overnight_bsp_full.log'
$logDir = Split-Path $log
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }

function Log([string]$msg) {
  $line = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg
  Add-Content -Path $log -Value $line -Encoding UTF8
  Write-Host $line
}

Log '=== overnight BSP full start ==='
try {
  $h = Invoke-WebRequest -Uri 'http://127.0.0.1:5000/health' -UseBasicParsing -TimeoutSec 30
  Log ("health ok: " + $h.Content.Substring(0, [Math]::Min(160, $h.Content.Length)))
} catch {
  Log ("FATAL: Flask not reachable on :5000 — $($_.Exception.Message)")
  exit 2
}

Log 'Running full BSP --force --loop --checkpoint 25'
& python -u scripts/build_msy_rankings_dc.py --base http://127.0.0.1:5000 --force --loop --checkpoint 25 --workers 0
if ($LASTEXITCODE -ne 0) {
  Log "FATAL: BSP rebuild exit $LASTEXITCODE"
  exit $LASTEXITCODE
}
Log 'BSP rebuild finished OK'

Log 'Building shards'
& python -u scripts/build_bsp_shards.py
if ($LASTEXITCODE -ne 0) {
  Log "FATAL: shards exit $LASTEXITCODE"
  exit $LASTEXITCODE
}
Log 'Shards OK'

Log 'Git status before commit'
& git status --short

$paths = @(
  'data/published/msy__v20_bsp_dc_EN_lb3_tp20_du0_dc0.json.gz',
  'data/published/msy_sort_index_EN.json.gz',
  'data/published/bsp_shards',
  'static/js/app.js',
  'static/js/app.min.js',
  'static/js/unit_best_pilots.js',
  'static/css/unit_best_pilots.css',
  'meta_synergy_rank.py',
  'scripts/overnight_bsp_full_and_push.ps1'
)
foreach ($p in $paths) {
  if (Test-Path $p) { & git add -- $p }
}

$staged = (& git diff --cached --name-only)
if (-not $staged) {
  Log 'Nothing staged to commit — skipping push'
  exit 0
}

Log ("Staged:`n" + ($staged -join "`n"))
$msgFile = Join-Path $env:TEMP 'ggen_bsp_overnight_commit_msg.txt'
$commitMsg = "Refresh BSP catalog after kit rebalance and add UR rarity filter.`n`nFull /cal rebuild plus shards; Top 10 UR button cycles all / SSR-and-below / UR-only.`n"
[System.IO.File]::WriteAllText($msgFile, $commitMsg)
& git commit -F $msgFile
if ($LASTEXITCODE -ne 0) {
  Log "FATAL: commit exit $LASTEXITCODE"
  exit $LASTEXITCODE
}

# Strip accidental Co-authored-by if a hook added it
$head = & git log -1 --format='%B'
if ($head -match 'Co-authored-by:') {
  $clean = (($head -split "`n" | Where-Object { $_ -notmatch 'Co-authored-by:' }) -join "`n").TrimEnd() + "`n"
  [System.IO.File]::WriteAllText($msgFile, $clean)
  & git commit --amend -F $msgFile
}

Log 'Pushing to origin (Railway)'
& git push origin HEAD
if ($LASTEXITCODE -ne 0) {
  Log "FATAL: push exit $LASTEXITCODE"
  exit $LASTEXITCODE
}
Log '=== overnight BSP full done — pushed ==='
exit 0
