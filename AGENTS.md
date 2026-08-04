# Nguyên tắc phát triển

- Không commit secret và không lưu file `.env`; chỉ duy trì file ví dụ với dữ liệu giả.
- Luôn chạy `npm run lint`, `npm run typecheck`, `npm test` và `npm run build` trước khi hoàn tất.
- Không che lỗi bằng cách tắt rule kiểm tra.
- Không thêm chức năng spam, kéo thành viên trái phép hoặc tương tác giả.
- Mỗi migration phải có một file SQL riêng và không sửa migration đã triển khai.
- Mọi endpoint quản trị phải được thiết kế sẵn sàng để bổ sung xác thực.
- Không lưu toàn bộ nội dung tin nhắn khi không cần cho thống kê.
- Cập nhật README khi kiến trúc hoặc quy trình vận hành thay đổi.
