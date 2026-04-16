# Deploy thư mục backend lên Railway (upload từ máy, giống MCP deploy).
# Yêu cầu: đã railway login HOẶC biến RAILWAY_TOKEN (Account Settings -> Tokens).
# Sau lần đầu: có thể tạo project bằng: railway init
param(
  [switch]$Detach
)
$ErrorActionPreference = "Stop"
$backend = Join-Path (Split-Path $PSScriptRoot -Parent) "backend"
Set-Location $backend

if (-not (Get-Command railway -ErrorAction SilentlyContinue)) {
  npm install -g @railway/cli
}

railway whoami
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "Chua dang nhap Railway. Chon mot cach:"
  Write-Host "  1) railway login"
  Write-Host "  2) Dat bien RAILWAY_TOKEN (Railway -> Account -> Tokens) roi chay lai script."
  exit 1
}

if ($Detach) {
  railway up --detach .
} else {
  railway up .
}
