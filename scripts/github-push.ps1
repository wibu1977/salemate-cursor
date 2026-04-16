# Đẩy repo lên GitHub (monorepo: backend + frontend + ...).
# Tạo repo TRỐNG trên GitHub (không README) rồi chạy:
#   .\scripts\github-push.ps1 -RemoteUrl "https://github.com/USER/REPO.git"
param(
  [Parameter(Mandatory = $true)]
  [string]$RemoteUrl
)
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

$existing = git remote get-url origin 2>$null
if ($LASTEXITCODE -eq 0) {
  git remote set-url origin $RemoteUrl
  Write-Host "Updated remote origin -> $RemoteUrl"
} else {
  git remote add origin $RemoteUrl
  Write-Host "Added remote origin -> $RemoteUrl"
}

git push -u origin main
Write-Host "Done."
