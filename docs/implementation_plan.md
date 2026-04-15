# SALEMATE V1 - KẾ HOẠCH TRIỂN KHAI TOÀN DIỆN

## KIẾN TRÚC TỔNG QUAN (Updated)

```
┌─────────────────────────────────────────────────────────────────┐
│                        VERCEL (Seoul Edge)                       │
│                    Next.js + Tailwind CSS                        │
│         ┌──────────────┐  ┌──────────────┐  ┌──────────┐       │
│         │ Admin Dashboard│  │ Webview Pages│  │ Landing  │       │
│         └──────┬─────────┘  └──────┬───────┘  └──────────┘       │
└────────────────┼──────────────────┼──────────────────────────────┘
                 │ REST API          │
┌────────────────▼──────────────────▼──────────────────────────────┐
│              RAILWAY / VPS (Docker Compose - Seoul)               │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                    FastAPI (Main API)                      │    │
│  │  ┌────────────┐ ┌──────────┐ ┌───────────┐ ┌──────────┐ │    │
│  │  │Meta Webhook│ │Payment   │ │Admin APIs │ │AI Engine │ │    │
│  │  │Router      │ │& OCR     │ │Dashboard  │ │GPT-4o    │ │    │
│  │  └────────────┘ └──────────┘ └───────────┘ └──────────┘ │    │
│  └──────────────────────────────────────────────────────────┘    │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────────┐     │
│  │   Redis     │  │   Celery   │  │  Celery Beat (Cron)   │     │
│  │  (Broker)   │  │  (Workers) │  │  - Daily Report       │     │
│  │             │  │            │  │  - Clustering          │     │
│  └────────────┘  └────────────┘  └────────────────────────┘     │
└──────────────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────────┐
│                     SUPABASE (PostgreSQL + pgvector)              │
│  ┌────────────┐ ┌────────────┐ ┌──────────┐ ┌──────────────┐   │
│  │ Workspaces │ │ Customers  │ │ Orders   │ │ Inventory    │   │
│  │            │ │ (SCV)      │ │          │ │              │   │
│  └────────────┘ └────────────┘ └──────────┘ └──────────────┘   │
│  ┌────────────┐ ┌────────────┐ ┌──────────────────────────┐    │
│  │ Fraud_Logs │ │ Campaigns  │ │ pgvector (RAG Embeddings)│    │
│  └────────────┘ └────────────┘ └──────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────────┐
│                      EXTERNAL SERVICES                            │
│  ┌───────────┐ ┌──────────────┐ ┌─────────────┐ ┌────────────┐ │
│  │ Meta APIs  │ │ Toss Payments│ │ Google Cloud│ │ Cloudinary │ │
│  │ Messenger  │ │ (Gateway)    │ │ Vision OCR  │ │ (Bill Imgs)│ │
│  │ Instagram  │ │              │ │             │ │            │ │
│  └───────────┘ └──────────────┘ └─────────────┘ └────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## PHASE 1: PROJECT FOUNDATION (Ngày 1-3)

### 1.1 Backend - FastAPI Project Structure
```
backend/
├── app/
│   ├── main.py                 # FastAPI app entry
│   ├── config.py               # Settings & env vars
│   ├── database.py             # Supabase/PostgreSQL connection
│   ├── api/
│   │   ├── v1/
│   │   │   ├── webhook.py      # Meta webhook handler
│   │   │   ├── payments.py     # Toss + OCR endpoints
│   │   │   ├── admin.py        # Dashboard APIs
│   │   │   ├── campaigns.py    # Outreach APIs
│   │   │   └── inventory.py    # Inventory sync
│   │   └── deps.py             # Dependencies (auth, db session)
│   ├── models/                 # SQLAlchemy models
│   │   ├── workspace.py
│   │   ├── customer.py
│   │   ├── order.py
│   │   ├── inventory.py
│   │   ├── campaign.py
│   │   └── fraud_log.py
│   ├── schemas/                # Pydantic schemas
│   ├── services/               # Business logic
│   │   ├── meta_service.py     # Meta API wrapper
│   │   ├── ai_service.py       # GPT-4o mini + RAG
│   │   ├── payment_service.py  # Toss Payments logic
│   │   ├── ocr_service.py      # OCR + Fraud detection
│   │   ├── clustering_service.py
│   │   └── notification_service.py
│   ├── workers/                # Celery tasks
│   │   ├── daily_report.py
│   │   ├── clustering.py
│   │   └── outreach.py
│   └── utils/
│       ├── memo_code.py        # Memo code generator
│       ├── image_hash.py       # Bill image hashing
│       └── sheets_sync.py      # Google Sheets reader
├── Dockerfile
├── requirements.txt
├── alembic/                    # DB migrations
└── alembic.ini
```

### 1.2 Frontend - Next.js Project Structure
```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                    # Landing page
│   │   ├── login/page.tsx              # Facebook OAuth login
│   │   ├── dashboard/
│   │   │   ├── page.tsx                # Main dashboard (30s report)
│   │   │   ├── orders/page.tsx         # Order management
│   │   │   ├── inventory/page.tsx      # Inventory + sync
│   │   │   ├── campaigns/page.tsx      # AI Outreach campaigns
│   │   │   ├── campaigns/[id]/page.tsx # Campaign detail + approve
│   │   │   └── settings/page.tsx       # Workspace settings
│   │   └── webview/
│   │       ├── order/[id]/page.tsx     # Order detail (Messenger)
│   │       ├── approve/[id]/page.tsx   # Campaign approve (Messenger)
│   │       └── fraud/[id]/page.tsx     # Fraud review (Messenger)
│   ├── components/
│   │   ├── ui/                         # Reusable UI (shadcn/ui)
│   │   ├── dashboard/                  # Dashboard-specific
│   │   ├── charts/                     # Revenue charts
│   │   └── webview/                    # Webview-specific
│   ├── lib/
│   │   ├── api.ts                      # API client
│   │   ├── auth.ts                     # Auth helpers
│   │   └── utils.ts
│   └── styles/
├── next.config.js
├── tailwind.config.ts
├── package.json
└── Dockerfile
```

### 1.3 Docker Compose
```
docker-compose.yml
├── fastapi       (port 8000)
├── celery-worker (Celery worker)
├── celery-beat   (Celery scheduler)
├── redis         (port 6379)
└── nginx         (reverse proxy, port 80/443)
```

### 1.4 Supabase Database Schema (SQL migrations)
Tạo toàn bộ bảng: workspaces, customers, orders, inventory, campaigns, fraud_logs, embeddings.

---

## PHASE 2: META INTEGRATION & WEBHOOK (Ngày 4-6)

### Tasks:
- [ ] **2.1** Thiết lập Meta App (Facebook Developer Portal)
- [ ] **2.2** Implement GET `/webhook` - Hub Challenge verification
- [ ] **2.3** Implement POST `/webhook` - Message routing:
  - Nhận `page_id` → xác định Shop Page hay Salemate v1 Page
  - Shop Page → Queue vào AI pipeline
  - Salemate v1 → Parse admin command
- [ ] **2.4** Meta Send API wrapper (text, quick replies, buttons, webview)
- [ ] **2.5** Instagram webhook handler (DM integration)
- [ ] **2.6** Customer identification + SCV merge (phone-based)

### Lưu ý quan trọng:
- Sử dụng **Recurring Notifications** opt-in cho Outreach
- Xử lý **24h messaging window** policy của Meta
- Rate limiting cho Meta Send API

---

## PHASE 3: AI CHATBOT - KÊNH SHOP (Ngày 7-12)

### Tasks:
- [ ] **3.1** GPT-4o mini integration (OpenAI SDK)
- [ ] **3.2** RAG pipeline:
  - Embed sản phẩm vào Supabase pgvector
  - Similarity search khi khách hỏi về sản phẩm
- [ ] **3.3** Conversation state management (Redis)
- [ ] **3.4** Luồng tư vấn:
  - Chào hỏi → Hỏi nhu cầu → Gợi ý sản phẩm (RAG) → Trả lời thắc mắc
- [ ] **3.5** Luồng chốt đơn:
  - Thu thập: Sản phẩm, SL, SĐT, Địa chỉ
  - Backend sinh `memo_code` (SM_XXXX) - **KHÔNG cho AI sinh**
  - Gửi hướng dẫn thanh toán kèm memo_code
- [ ] **3.6** Multi-language support (Korean primary)
- [ ] **3.7** System prompt & guardrails (chỉ bán hàng, không trả lời off-topic)

---

## PHASE 4: THANH TOÁN & OCR CHỐNG GIAN LẬN (Ngày 13-18)

### 4A. Toss Payments Gateway
- [ ] **4.1** Toss Payments SDK integration (Server-side)
- [ ] **4.2** Payment flow:
  ```
  Khách nhận memo_code → Chuyển khoản qua Toss → 
  Toss webhook → Backend xác nhận → Cập nhật Order
  ```
- [ ] **4.3** Webview thanh toán (hiển thị thông tin chuyển khoản)
- [ ] **4.4** Tiền KHÔNG lưu trong hệ thống (pass-through model)

### 4B. OCR Chống Gian Lận
- [ ] **4.5** Google Cloud Vision OCR integration
- [ ] **4.6** Trích xuất từ ảnh bill: `bill_time`, `bill_memo`, `bill_amount`
- [ ] **4.7** Logic đối soát 4 lớp:
  | Lớp | Check | Fail Action |
  |-----|-------|-------------|
  | 1 - Thời gian | `bill_time >= order.created_at` | REJECT |
  | 2 - Nội dung | `bill_memo == order.memo_code` | FLAG → Admin |
  | 3 - Số tiền | `bill_amount == order.total_amount` | FLAG → Admin |
  | 4 - Trùng lặp | Image hash unique check | REJECT |
- [ ] **4.8** Image hashing (perceptual hash - chống chỉnh sửa nhẹ)
- [ ] **4.9** Cloudinary upload cho ảnh bill
- [ ] **4.10** Fraud_Logs ghi vết + thông báo Admin qua Salemate v1

### Fallback OCR (Cost Control):
- Nếu Google Cloud Vision phí cao → chuyển sang Tesseract OCR (open-source)

---

## PHASE 5: ADMIN DASHBOARD (Ngày 19-26)

### 5A. Authentication
- [ ] **5.1** Facebook OAuth Login (shop owner đăng nhập bằng FB)
- [ ] **5.2** JWT token management
- [ ] **5.3** Workspace authorization (shop owner chỉ thấy data của mình)

### 5B. Dashboard Pages
- [ ] **5.4** **Báo cáo 30 giây** (Trang chính):
  - Tổng doanh thu hôm nay / tuần / tháng
  - Số đơn hàng (pending, confirmed, flagged)
  - Top sản phẩm bán chạy
  - Cảnh báo tồn kho thấp
- [ ] **5.5** **Quản lý Đơn hàng**:
  - Danh sách đơn (filter: status, date)
  - Chi tiết đơn + ảnh bill OCR
  - Duyệt/Từ chối đơn bị FLAG
- [ ] **5.6** **Quản lý Tồn kho**:
  - Danh sách sản phẩm + số lượng
  - Chỉnh sửa `stock_threshold`
  - Nút sync Google Sheets / Upload Excel
- [ ] **5.7** **Cài đặt Workspace**:
  - Kết nối Facebook Page(s)
  - Cấu hình giờ gửi báo cáo
  - Quản lý system prompt cho AI

### 5C. Webview Pages (Trong Messenger)
- [ ] **5.8** Order detail view (cho admin review trong Messenger)
- [ ] **5.9** Fraud alert detail view
- [ ] **5.10** Campaign approval view

---

## PHASE 6: AI OUTREACH & CAMPAIGNS (Ngày 27-32)

### Tasks:
- [x] **6.1** Celery Beat job: Customer clustering
  - Input: tần suất mua, giá trị đơn, recency
  - Output: clusters (VIP, Regular, Dormant, New)
- [x] **6.2** AI soạn tin nhắn cho từng cluster
- [x] **6.3** Campaign management API (CRUD)
  - List/create/get/approve; thêm PATCH + DELETE (trạng thái cho phép); JWT webview token
- [x] **6.4** Webview preview + approval flow:
  ```
  AI soạn tin → Gửi preview qua Salemate v1 Messenger →
  Chủ shop mở Webview → Duyệt/Yêu cầu viết lại → 
  Gửi Recurring Notifications
  ```
  - Route Next: `/webview/campaign/[id]?token=...` · API: `GET/POST /webview/campaigns/{id}`
- [x] **6.5** Meta Recurring Notifications integration
- [x] **6.6** Campaign analytics (sent, opened, converted)
  - `opened_count` tăng theo webhook **message delivery** (mid khớp `campaign_messages.meta_message_id`); `converted_count` giữ chỗ (tính từ đơn sau)

---

## PHASE 7: AUTOMATION & CRON JOBS (Ngày 33-35)

- [x] **7.1** Daily Report task (Celery Beat):
  - Tổng hợp revenue (today/week/month), orders, top 5 sản phẩm, low-stock alerts
  - Rich formatting gửi qua Salemate v1 Messenger vào giờ đã cài (KST)
  - `AdminService._top_products_today()` — top 5 sản phẩm bán chạy hôm nay
- [x] **7.2** Inventory monitoring:
  - `stock_service.deduct_stock_and_alert()` — centralised stock deduction + Messenger alert
  - Wired vào mọi confirm path: Toss confirm, Toss webhook, OCR verify (API + Messenger), Admin approve
  - Chỉ alert khi stock **vừa** rơi xuống ngưỡng (tránh spam)
  - Xóa optimistic deduction cũ trong `ai_service.py` → chỉ deduct khi confirmed
- [x] **7.3** Re-clustering job (hàng tuần):
  - Celery Beat: Monday 03:00 KST (đã có)
  - Thêm `_notify_clustering_done()` — gửi Messenger thông báo khi clustering hoàn tất
  - Fix Vietnamese diacritics cho fallback labels + LLM prompt

---

## PHASE 8: DEPLOYMENT & GO-LIVE (Ngày 36-40)

### Infrastructure Setup:
- [ ] **8.1** Vercel deploy Next.js (Seoul Edge)
- [ ] **8.2** Railway.app / VPS:
  - Docker Compose: FastAPI + Redis + Celery + Nginx
  - SSL certificate (Let's Encrypt)
- [ ] **8.3** Supabase project setup (Seoul region)
- [ ] **8.4** Domain + DNS configuration
- [ ] **8.5** Environment variables management

### Monitoring & Security:
- [ ] **8.6** Logging (structured JSON logs)
- [ ] **8.7** Error tracking (Sentry free tier)
- [ ] **8.8** API rate limiting
- [ ] **8.9** CORS & security headers
- [ ] **8.10** Meta App Review submission

---

## CHI PHÍ ƯỚC TÍNH (Monthly - Solo Founder)

| Service | Plan | Cost |
|---------|------|------|
| Vercel | Free/Hobby | $0-20 |
| Railway / VPS | Starter | $5-15 |
| Supabase | Free Tier | $0 |
| Redis | Railway addon | $0-5 |
| Cloudinary | Free Tier (25GB) | $0 |
| OpenAI GPT-4o mini | Pay-as-you-go | ~$10-30 |
| Google Cloud Vision | 1000 free/mo | $0-10 |
| Domain | .com | $12/year |
| **TỔNG** | | **~$27-80/tháng** |

---

## THỨ TỰ TRIỂN KHAI KHUYẾN NGHỊ

```
Phase 1 (Foundation)     ████████░░░░░░░░░░░░  Ngày 1-3
Phase 2 (Meta Webhook)   ░░░████████░░░░░░░░░  Ngày 4-6
Phase 3 (AI Chatbot)     ░░░░░░████████████░░  Ngày 7-12
Phase 4 (Payment+OCR)    ░░░░░░░░░░░░████████  Ngày 13-18
Phase 5 (Dashboard)      ░░░░░░░░░░░░░░░░████████████████  Ngày 19-26
Phase 6 (Outreach)       ░░░░░░░░░░░░░░░░░░░░░░░░████████████  Ngày 27-32
Phase 7 (Automation)     ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░████  Ngày 33-35
Phase 8 (Deploy)         ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░████████  Ngày 36-40
```
