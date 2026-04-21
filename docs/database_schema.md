# DATABASE SCHEMA & SCV

## 1. Single Customer View (SCV)
Sử dụng **Số điện thoại** làm chìa khóa chính để hợp nhất định danh khách hàng từ Facebook và Instagram.

## 2. Các bảng chính (Tables)
- **Workspaces**: Quản lý các nhóm Page của cùng một chủ shop.
- **Customers**: Lưu `global_user_id`, SĐT, Email, và lịch sử tương tác đa kênh.
- **Inventory**: 
    - `quantity`: Số lượng hiện có.
    - `stock_threshold`: Ngưỡng cảnh báo tự động gửi tin nhắn cho chủ shop.
- **Orders**: Lưu trạng thái thanh toán, `memo_code`, và ảnh bill đối soát.
- **Fraud_Logs**: Lưu vết các lần thanh toán bị lỗi hoặc nghi vấn gian lận.

## 3. Đồng bộ Kho (Sync)
Hỗ trợ đọc dữ liệu từ Google Sheets/Excel. Khi `quantity` giảm về mức `stock_threshold`, gửi tin nhắn cảnh báo ngay lập tức qua **Salemate v1**.