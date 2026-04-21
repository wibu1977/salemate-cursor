# Deploy: Railway (khuyến nghị) — hoặc kèm Vercel

## Phương án dễ triển khai nhất — **chỉ Railway** (1 project, 2 service)

Backend bạn chưa chạy ổn thì **làm API trước**, dashboard sau — cùng một tài khoản Railway, dễ nối URL.

| Thứ tự | Service | Root Directory | Build | Start / Deploy |
|--------|---------|----------------|-------|----------------|
| **1** | **API** | *(để trống — dùng Dockerfile ở root repo)* hoặc `backend` | Docker build (root `Dockerfile` đã có) | Image đã có `CMD` uvicorn + `$PORT` |
| **2** | **Dashboard (Next.js)** | `frontend` | `npm install && npm run build` | `npm run start:railway` (lắng nghe `0.0.0.0`, cổng lấy từ `$PORT` của Railway) |

**Biến môi trường**

- **Service API:** copy logic từ `backend/.env` (không commit file): `DATABASE_URL`, `JWT_SECRET_KEY`, `REDIS_URL`, Meta, OpenAI, v.v. Thêm **`CORS_ORIGINS`** = URL public của **service Dashboard** (sau khi Railway cấp domain, dạng `https://xxx.up.railway.app`).
- **Service Dashboard:** `NEXT_PUBLIC_API_URL` = URL public **service API** — **bắt buộc** `https://...` (**không** dùng `http://`: client sẽ fallback `/api` và proxy trong container trỏ `127.0.0.1:8000` → lỗi). **Không** `/` cuối. Sau khi đổi: **redeploy / build lại** frontend. Thêm `NEXT_PUBLIC_META_APP_ID` = App ID Meta.
- **Supabase Auth (email magic link + Google):** trên frontend thêm `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Settings → API). Trên backend API thêm **`SUPABASE_JWT_SECRET`** = **JWT Secret** (cùng màn API — **không** phải anon key). Trong Supabase Dashboard → Authentication → URL: thêm **Redirect URLs** `https://<dashboard-domain>/auth/callback` (và `http://localhost:3000/auth/callback` khi dev HTTPS). Bật provider **Google** và **Email**. Chạy migration SQL [`database/003_supabase_auth_workspaces.sql`](database/003_supabase_auth_workspaces.sql) trên Postgres (Supabase SQL Editor hoặc DB Railway).

**Health check API:** trong Railway → API service → Health check path: `/health` hoặc `/`.

**Meta / Facebook:** thêm domain Railway của **Dashboard** vào App Domains + OAuth Redirect URIs (HTTPS). Sau đăng nhập Supabase, dùng trang **Kết nối Facebook** (`/connect-facebook`) hoặc **Cài đặt** để nối Page.

Sau khi API mở được `https://<api>/health`, mới deploy service Dashboard và set `NEXT_PUBLIC_API_URL`.

### Railway — Làm trên web (từng bước)

1. **Tạo project:** [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub** → chọn repo `salemate-cursor` (hoặc repo của bạn).
2. **Service 1 — API (làm trước):**
   - Railway tạo sẵn một service đầu tiên — dùng luôn cho API.
   - **Settings → Root Directory:** để **trống** (repo root) để Railway đọc `railway.toml` + `Dockerfile` ở root — build Docker copy `backend/`.  
     *Hoặc* đặt Root = `backend` và trong **Settings → Build** chọn **Dockerfile** trỏ tới `Dockerfile` trong thư mục đó (file `backend/Dockerfile` đã có `CMD` với `$PORT`).
   - **Variables:** dán toàn bộ biến production giống `backend/.env` (Postgres `DATABASE_URL` / `DATABASE_URL_SYNC`, `REDIS_URL`, `JWT_SECRET_KEY`, Meta, OpenAI, …). **Chưa** cần `CORS_ORIGINS` đúng hết nếu chưa có URL frontend — có thể thêm sau bước 3.
   - **Deploy** → đợi build xong → **Settings → Networking → Generate Domain** → mở trình duyệt `https://<api-domain>/health` (hoặc `/`) phải ra JSON `status: ok`.
   - **Health check:** Settings → **Health Check Path** = `/health` hoặc `/`.
3. **Service 2 — Dashboard (Next.js):**
   - Trong cùng project → **New** → **GitHub Repo** → chọn **cùng repo**.
   - **Settings → Root Directory:** `frontend` (bắt buộc — để Nixpacks chỉ thấy `package.json` của Next).
   - **Settings → Deploy:**
     - **Build Command:** `npm install && npm run build` (hoặc `npm ci && npm run build` nếu bạn commit `package-lock.json`).
     - **Start Command:** `npm run start:railway` — **không** dùng mặc định `next start` một mình nếu app không bind `0.0.0.0` (script `start:railway` đã có `-H 0.0.0.0`; Railway gán `PORT` tự động).
   - **Variables:**  
     - `NEXT_PUBLIC_API_URL` = URL HTTPS của service API (bước 2), **không** có `/` ở cuối.  
     - `NEXT_PUBLIC_META_APP_ID` = App ID Meta (nếu dùng login Meta).
   - **Generate Domain** cho Dashboard → copy URL `https://<web>.up.railway.app`.
4. **Nối CORS:** quay lại **service API → Variables** → thêm / sửa **`CORS_ORIGINS`** để **gồm** URL Dashboard vừa tạo.  
   Với Pydantic Settings, danh sách thường set bằng **JSON một dòng**, ví dụ:  
   `["https://xxx.up.railway.app"]`  
   (nếu nhiều domain: `["https://a.up.railway.app","https://b.vercel.app"]`).  
   Redeploy API sau khi đổi biến.
5. **Meta / OAuth:** trong Meta Developer → App → thêm domain + redirect URI trỏ tới URL Dashboard Railway (HTTPS).

### Railway — Lỗi thường gặp

| Triệu chứng / log | Nguyên nhân hay gặp | Cách xử |
|-------------------|---------------------|---------|
| Build API: “cannot find Dockerfile” / context sai | Root Directory trỏ nhầm hoặc thiếu file | API: root trống + `Dockerfile` ở root repo, **hoặc** Root = `backend` + Dockerfile trong `backend/`. |
| API deploy OK nhưng browser / health “connection refused” | App không listen `0.0.0.0` hoặc sai port | `CMD` phải dùng `--host 0.0.0.0 --port ${PORT:-8000}` (Dockerfile đã có). |
| Log Uvicorn màu đỏ, số cổng 8080 | Thường là **stderr** + `$PORT` của Railway | Không phải lỗi nếu `/health` vẫn 200. |
| Health check failed / 404 | Probe gọi `/` mà app không có route | Repo đã có `GET /` và `/health` — đặt Health Check Path = `/health` hoặc `/`. |
| Frontend build fail (TypeScript / ESLint) | Lỗi thật trong code | Chạy local `cd frontend && npm run check`; sửa đến khi pass. |
| Frontend chạy nhưng login / API lỗi, Network tab gọi `127.0.0.1` | Thiếu `NEXT_PUBLIC_API_URL` HTTPS | Set biến trên service **Dashboard**, **rebuild** (build time embed biến `NEXT_PUBLIC_*`). |
| CORS error trong console | Backend không cho origin Dashboard | Thêm URL Dashboard vào `CORS_ORIGINS` (dạng JSON array), redeploy API. |
| Đăng nhập Facebook: “SDK chưa tải” / `window.FB` undefined | Thiếu `NEXT_PUBLIC_META_APP_ID` khi **build** (SDK không inject script), hoặc AdBlock chặn `connect.facebook.net` | Railway → Frontend → Variables: `NEXT_PUBLIC_META_APP_ID` = App ID (số) → **Redeploy**. Tắt AdBlock cho domain `*.up.railway.app`. Meta App: **App domains** + **Valid OAuth Redirect URIs** = URL Dashboard (HTTPS). |
| DB: SSL / connection timeout | `DATABASE_URL` sai host hoặc thiếu SSL | Dùng URL đúng từ Railway Postgres / Supabase; kiểm tra firewall và `?sslmode=require` nếu provider yêu cầu. |

---

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
2. Thêm biến môi trường: copy từ `backend/.env.example`, điền Production (Postgres URL async + sync, Redis, Meta, OpenAI, Toss, JWT, `CORS_ORIGINS` = URL frontend — **Railway Dashboard** hoặc Vercel nếu vẫn dùng).
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

- API: `GET https://<api>/health` hoặc `GET https://<api>/` → `{ "status": "ok", ... }` (có route `/` để Railway / probe mặc định không bị 404).

**Railway:** Log Uvicorn màu **đỏ** thường là do ghi ra **stderr** (bình thường), không phải lỗi. Cổng **`8080`** là biến `$PORT` của platform — app phải lắng nghe `${PORT}` (Dockerfile đã dùng). Nếu deploy fail, trong Service → **Health Check Path** nên đặt `/health` hoặc `/`.
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
