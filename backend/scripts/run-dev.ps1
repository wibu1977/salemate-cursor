# Chạy API local — dùng Python 3.12+ (wheel ổn định trên Windows; tránh 3.14 nếu pip build lỗi).
Set-Location $PSScriptRoot\..
py -3.12 -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
