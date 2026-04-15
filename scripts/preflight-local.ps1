# Chạy kiểm tra local trước deploy (PowerShell). Có thể chạy từ bất kỳ đâu.
$ErrorActionPreference = "Stop"
# Thư mục gốc repo = cha của thư mục scripts/
$root = Split-Path -Parent $PSScriptRoot

Write-Host "== Frontend: lint + build ==" -ForegroundColor Cyan
Set-Location (Join-Path $root "frontend")
npm install
npm run check

Write-Host "`n== Backend: pytest ==" -ForegroundColor Cyan
Set-Location (Join-Path $root "backend")
$py = $null
if (Get-Command python -ErrorAction SilentlyContinue) { $py = "python" }
elseif (Get-Command py -ErrorAction SilentlyContinue) { $py = "py" }
if (-not $py) {
    Write-Warning "Không tìm thấy 'python' hoặc 'py'. Cài Python 3.11+ rồi chạy lại."
    exit 1
}
& $py -m pip install -r requirements-dev.txt -q
& $py -m pytest

Write-Host "`nOK — sẵn sàng deploy." -ForegroundColor Green
