# LOGIC XÁC THỰC THANH TOÁN & OCR

## 1. Quy trình Chốt đơn
1. AI (GPT-4o mini) thu thập thông tin đơn hàng.
2. **Code Execution (Backend)**: Hệ thống tự động tạo `memo_code` (Ví dụ: SM_1234). **Cấm AI tự sinh mã này.**
3. Gửi hướng dẫn thanh toán kèm `memo_code` cho khách.

## 2. Logic OCR Chống gian lận (4 Lớp)
Khi nhận ảnh bill từ khách, hệ thống thực hiện trích xuất dữ liệu và đối soát:

| Lớp kiểm tra | Logic thực hiện | Hành động nếu sai |
| :--- | :--- | :--- |
| **Thời gian** | `bill_time` phải >= `order.created_at`. | REJECT (Bill cũ). |
| **Nội dung** | `bill_memo` phải khớp hoàn toàn với `order.memo_code`. | FLAG (Báo cáo Admin). |
| **Số tiền** | `bill_amount` phải bằng `order.total_amount`. | FLAG (Báo cáo Admin). |
| **Trùng lặp** | Kiểm tra Image Hash trong `success_orders`. | REJECT (Double spending). |

## 3. Thông báo Quản trị
Mọi trường hợp bị **FLAG** phải gửi thông báo kèm link Webview tới Messenger của chủ shop thông qua Page **Salemate v1**.