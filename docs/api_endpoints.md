# API ENDPOINTS & WEBHOOKS

## 1. Meta Webhooks (Messenger & Instagram)
Đây là cổng nhận tin nhắn từ khách hàng (tại Page Shop) và lệnh từ chủ shop (tại Page Salemate v1).

- **GET `/webhook`**: Xác thực Webhook với Meta (Hub Challenge).
- **POST `/webhook`**: 
    - Xử lý tin nhắn đến (Text, Image, Postback).
    - **Logic phân luồng**: 
        - Nếu `page_id` là Shop Page -> Chuyển vào luồng AI Tư vấn & Chốt đơn.
        - Nếu `page_id` là Salemate v1 -> Chuyển vào luồng Quản trị (Admin commands).

## 2. Payment & OCR Endpoints
- **POST `/payments/toss/webhook`**: Tiếp nhận trạng thái thanh toán từ Toss Payments SDK.
- **POST `/payments/ocr/verify`**: 
    - Nhận ảnh bill từ Messenger.
    - Gọi Google Cloud Vision để trích xuất dữ liệu.
    - Thực hiện logic đối soát 4 lớp (Thời gian, Memo, Số tiền, Trùng lặp).

## 3. Dashboard & Webview APIs (Internal)
Các API phục vụ cho giao diện quản trị trên Website và Webview trong Messenger.

- **GET `/admin/dashboard/summary`**: Lấy dữ liệu tổng hợp doanh thu, đơn hàng cho báo cáo 30 giây.
- **GET `/admin/campaigns`**: Lấy danh sách các cụm khách hàng (Clusters) và đề xuất Outreach từ AI.
- **POST `/admin/campaigns/{id}/approve`**: Phê duyệt và bắt đầu gửi tin nhắn hàng loạt qua Recurring Notifications.
- **PATCH `/admin/inventory/sync`**: Kích hoạt đồng bộ tồn kho thủ công từ Google Sheets/Excel.

## 4. Automation Tasks (Cron Jobs)
- **POST `/tasks/daily-report`**: Chạy vào khung giờ chủ shop cài đặt để gửi báo cáo tóm tắt qua Salemate v1.
- **POST `/tasks/clustering`**: Chạy định kỳ để AI phân tích lại hành vi khách hàng trong Database.