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

**Monorepo (repo có `frontend/`, `backend/`, …):** một trong hai cách:

- **Cách A (khuyến nghị):** Trong Railway → Service → **Settings → Root Directory** = `backend`. Railpack/Nixpacks sẽ thấy `requirements.txt` và Python đúng chỗ.
- **Cách B:** Giữ root repo làm thư mục build — dùng **`Dockerfile` + `railway.toml` ở root** (đã có trong repo): build image bằng Docker, copy nội dung từ `backend/`. Không cần `start.sh`.

1. Tạo project mới → **Deploy from GitHub** (chọn repo). Nếu dùng cách A, đặt **Root Directory** = `backend`.
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

---

## Sau khi deploy Vercel (bắt buộc cho login / dashboard)

Trên **Vercel → Project → Settings → Environment Variables**, thêm:

| Biến | Giá trị |
|------|--------|
| `NEXT_PUBLIC_API_URL` | URL public của API (Railway), ví dụ `https://xxx.up.railway.app` — **không** có `/` cuối |
| `NEXT_PUBLIC_META_APP_ID` | App ID Meta (cùng số trong Meta Developer) |

Không set `NEXT_PUBLIC_API_URL` thì build client có thể gọi nhầm `127.0.0.1:8000` qua rewrite và **đăng nhập sẽ lỗi** trên môi trường production.

Trên **Railway / backend**, thêm domain Vercel vào `CORS_ORIGINS` (hoặc dùng các URL mặc định đã có trong `app/config.py` nếu trùng project).

---

## Đẩy code lên GitHub

1. Tạo repository **trống** trên GitHub (không tick “Add README”).
2. Trên máy (đã cài Git, đã `git config user.name` / `user.email`):
   ```powershell
   cd "C:\Users\user\Downloads\salemate cursor"
   .\scripts\github-push.ps1 -RemoteUrl "https://github.com/<USER>/<REPO>.git"
   ```
3. Nếu GitHub hỏi đăng nhập: dùng **Personal Access Token** (classic) quyền `repo` làm mật khẩu HTTPS, hoặc cấu hình **SSH** (`git@github.com:USER/REPO.git`).

---

## Railway CLI + MCP (deploy backend)

1. Cài CLI (một lần): `npm install -g @railway/cli`
2. **Đăng nhập** (một trong hai):
   - Tương tác: `railway login`
   - Không tương tác (Cursor / MCP / CI): [Railway → Account → Tokens](https://railway.app/account/tokens) → tạo token → đặt biến môi trường **`RAILWAY_TOKEN`**, mở terminal mới và kiểm tra `railway whoami`
3. Trong thư mục **`backend`**, lần đầu: `railway init` (chọn project / tạo service) hoặc tạo project trên [railway.app](https://railway.app) rồi `railway link`.
4. Deploy upload từ máy:
   ```powershell
   .\scripts\railway-deploy-backend.ps1 -Detach
   ```
   Hoặc: `cd backend` → `railway up --detach`

**MCP `user-Railway` trong Cursor** dùng cùng CLI: cần `railway` trên `PATH` và đã login hoặc có `RAILWAY_TOKEN`. Sau đó có thể gọi tool **deploy** với `workspacePath` = đường dẫn tuyệt đối tới thư mục `backend`.

**Deploy từ GitHub (khuyến nghị cho CI):** trên Railway → New Project → **Deploy from GitHub** → chọn repo → **Root Directory** = `backend` → thêm biến môi trường giống `backend/.env` (production).
