# Save live vote totals into the repo before you push a site update.
# Usage:
#   .\scripts\snapshot_banner_votes.ps1 -SiteUrl "https://YOUR-APP.up.railway.app"
#
# Then commit and push with your code (no Railway auto-commits to GitHub):
#   git add data/published/banner_pool_votes.json
#   git commit -m "Save vote totals before deploy"
#   git push origin main

param(
    [Parameter(Mandatory = $true)]
    [string]$SiteUrl,
    [string]$OutFile = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if (-not $OutFile) {
    $OutFile = Join-Path $root "data\published\banner_pool_votes.json"
}

$base = $SiteUrl.TrimEnd("/")
$uri = "$base/api/banner_timeline/votes?client_id=snapshot"
Write-Host "Fetching $uri"
$resp = Invoke-RestMethod -Uri $uri -Method Get
$totals = $resp.totals
if ($null -eq $totals) { $totals = @{} }

$out = @{
    totals  = $totals
    ballots = @{}
}
$json = $out | ConvertTo-Json -Depth 30
$dir = Split-Path -Parent $OutFile
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
[System.IO.File]::WriteAllText($OutFile, $json + "`n", [System.Text.UTF8Encoding]::new($false))
Write-Host "Wrote $OutFile"
Write-Host "Next: git add data/published/banner_pool_votes.json && git commit && git push origin main"
