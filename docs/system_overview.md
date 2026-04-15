# SALEMATE V1 - SYSTEM OVERVIEW

## 1. Mục tiêu dự án
Xây dựng hệ thống SaaS hỗ trợ các hộ kinh doanh (SME/Micro) tại Hàn Quốc (F&B, Thời trang, Mỹ phẩm) tự động hóa bán hàng và quản trị qua Messenger/Instagram.

## 2. Mô hình Giao tiếp (Dual-Channel)
- **Kênh Khách hàng**: Messenger/Instagram của cửa hàng (ví dụ: Quán Cuốn Seoul) dùng GPT-4o mini để tư vấn và chốt đơn.
- **Kênh Quản trị**: Messenger của Page **Salemate v1**. Đây là nơi chủ shop nhận thông báo, duyệt đơn và quản lý chiến dịch.

## 3. Tech Stack Cốt lõi
- **Backend**: FastAPI (Python) + Celery + Redis - Xử lý bất đồng bộ.
- **Frontend**: Next.js & Tailwind CSS - Phong cách Minimalism/Swiss Style. Dashboard admin riêng.
- **AI**: GPT-4o mini (RAG & Extraction).
- **Database**: Supabase (PostgreSQL + pgvector cho Vector DB).
- **Payment**: Toss Payments SDK (pass-through, tiền không lưu trong hệ thống).
- **OCR**: Google Cloud Vision (fallback: Tesseract open-source).
- **Storage**: Cloudinary (ảnh bill OCR).

## 4. Lean Deployment Strategy (Solo Founder)
- **Frontend**: Vercel (Hỗ trợ Next.js, Region: Seoul Edge).
- **Backend & Workers**: Railway.app hoặc Docker trên VPS (Vultr/DigitalOcean - Region: Seoul).
- **Database**: Supabase (PostgreSQL + pgvector) - Free Tier.
- **Containerization**: Docker Compose (FastAPI, Redis, Celery).
- **Storage**: Cloudinary (Free tier) cho ảnh bill OCR.
