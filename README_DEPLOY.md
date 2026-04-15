# Deploy nhanh: Railway (Backend) + Vercel (Frontend)

## Kiểm tra local trước khi deploy

Chuẩn bị `.env` trong `backend` (copy từ `backend/.env.example`) và `frontend/.env.local` từ `frontend/.env.example` — ít nhất `DATABASE_URL` hợp lệ để import app (hoặc Postgres local/Docker).

**Frontend** (từ thư mục `frontend`):

```bash
npm install
npm run check
```

(`check` = lint + production build — giống những gì Vercel chạy.)

**Backend** (từ thư mục `backend`):

```bash
pip install -r requirements-dev.txt
pytest
```

- `test_settings_loads` chạy ngay (không cần DB).
- `test_health_ok` gọi FastAPI thật — cần cài đủ `requirements.txt` (pgvector, …). Nếu thiếu gói, test đó **bị skip** (không fail). Khi đã cài đủ, cả hai test phải pass.

**Chạy tay (tùy chọn):** `uvicorn app.main:app --reload` và mở `http://127.0.0.1:8000/health`.

Trên Windows PowerShell: `.\scripts\preflight-local.ps1` (từ thư mục gốc repo) — chạy `npm run check` + `pytest`.

ESLint có thể báo **warning** (vd. `<img>`); miễn `npm run check` exit code 0 là có thể deploy.

---

## Backend (Railway)

1. Tạo project mới → **Deploy from GitHub** (chọn repo), **Root Directory** = `backend`.
2. Thêm biến môi trường: copy từ `backend/.env.example`, điền Production (Postgres URL async + sync, Redis, Meta, OpenAI, Toss, JWT, `CORS_ORIGINS` = URL Vercel).
3. **Start command** (Web service):  
   `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Postgres: dùng Supabase hoặc **Railway PostgreSQL**; cập nhật `DATABASE_URL` / `DATABASE_URL_SYNC` cho khớp.
5. Redis: plugin Redis trên Railway hoặc Upstash — gán `REDIS_URL`.
6. **Celery** (tùy chọn nhưng nên có): tạo thêm service cùng repo, root `backend`, command ví dụ:  
   `celery -A app.workers.celery_app worker -l info`  
   Và một service **Celery Beat**:  
   `celery -A app.workers.celery_app beat -l info`  
   Cùng biến môi trường như Web (nhất là `DATABASE_URL`, `REDIS_URL`).
7. Meta Developer: **Webhook** trỏ tới `https://<api-domain>/webhook`, verify token = `META_VERIFY_TOKEN`.

## Frontend (Vercel)

1. Import repo → **Root Directory** = `frontend`.
2. Biến môi trường: `NEXT_PUBLIC_API_URL` = URL public Railway (API), `NEXT_PUBLIC_META_APP_ID` = App ID Meta.
3. Deploy. Mở app Vercel → thêm URL đó vào `CORS_ORIGINS` bên backend và (nếu cần) cấu hình OAuth Meta cho đúng domain.

## Kiểm tra

- API: `GET https://<api>/health` → `{ "status": "ok", ... }`.
- Frontend gọi API qua `NEXT_PUBLIC_API_URL` và rewrite `/api/*` trong `next.config.js`.
