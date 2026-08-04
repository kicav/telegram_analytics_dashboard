# Telegram Analytics Dashboard

Phiên bản nền tảng đầu tiên của dashboard tiếng Việt dành cho chủ sở hữu và quản trị viên nhóm/kênh Telegram. Ứng dụng dùng React, TypeScript strict, Cloudflare Workers và D1; mặc định hiển thị dữ liệu minh họa và múi giờ `Asia/Ho_Chi_Minh`.

> Dự án chỉ phục vụ phân tích hợp pháp. Không có chức năng spam, kéo thành viên, tạo reaction giả hay sử dụng Telegram session mua ngoài.

## Chức năng hiện có

- Dashboard responsive gồm thành viên, tăng trưởng, hoạt động 7/30 ngày, bài viết, reaction và chiến dịch.
- Biểu đồ tăng trưởng, bài viết nổi bật, chiến dịch gần đây; có trạng thái loading, empty và error.
- Worker API với health check, webhook Telegram và các endpoint đọc dashboard được bảo vệ bằng khóa quản trị.
- Webhook xác thực `X-Telegram-Bot-Api-Secret-Token`, chống trùng bằng `update_id`, chỉ giữ excerpt bài viết tối đa 160 ký tự và không log secret/nội dung nhạy cảm.
- Schema D1 ban đầu gồm đầy đủ quan hệ, index, foreign key và unique constraint.

## Cấu trúc

```text
├── migrations/0001_initial.sql  # Schema D1 đầu tiên
├── src/                         # Dashboard React và dữ liệu demo
├── tests/                       # Kiểm thử Vitest
├── worker/                      # Hono Worker, webhook và analytics
├── .dev.vars.example            # Tên biến môi trường với giá trị giả
├── wrangler.jsonc               # Cấu hình Worker/D1
└── vite.config.ts               # Vite + Cloudflare plugin
```

## Chạy local

Yêu cầu Node.js 20+ và npm.

```bash
npm install
cp .dev.vars.example .dev.vars
npm run dev
```

Không commit `.dev.vars`. Dashboard Vite và Worker được Cloudflare Vite plugin phục vụ cùng nhau. Có thể chạy riêng Worker bằng `npm run dev:worker`.

## Kiểm tra chất lượng

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Tạo và cấu hình Cloudflare D1

Đăng nhập Wrangler rồi tạo database:

```bash
npx wrangler login
npx wrangler d1 create telegram-analytics
```

Sao chép `database_id` trả về vào placeholder trong `wrangler.jsonc`. Chạy migration local hoặc remote:

```bash
npx wrangler d1 migrations apply telegram-analytics --local
npx wrangler d1 migrations apply telegram-analytics --remote
```

## Khai báo secret

Local: sao chép `.dev.vars.example` thành `.dev.vars` và thay bằng secret phát triển. Cloudflare (ở bước triển khai sau):

```bash
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
npx wrangler secret put ADMIN_API_KEY
```

Khi cấu hình webhook Telegram, dùng cùng giá trị trong tham số `secret_token`. Bot token và webhook secret thật tuyệt đối không đưa vào mã nguồn, log hoặc cấu hình version control.

## API

| Method | Endpoint | Mục đích |
|---|---|---|
| GET | `/api/health` | Kiểm tra Worker |
| POST | `/api/telegram/webhook` | Nhận update Telegram an toàn/idempotent |
| GET | `/api/dashboard/overview` | Chỉ số tổng quan mới nhất |
| GET | `/api/dashboard/member-growth` | Tăng trưởng 30 ngày |
| GET | `/api/posts` | Bài viết gần đây |
| GET | `/api/campaigns` | Chiến dịch và chuyển đổi |

Các endpoint dashboard, bài viết và chiến dịch yêu cầu header `X-Admin-Api-Key`; health check vẫn công khai và webhook dùng secret riêng của Telegram. Đây là lớp bảo vệ nền tảng, nên thay bằng phiên đăng nhập có phân quyền trước khi production. Webhook đã có nhánh xử lý cho `chat_member`, `message`, `channel_post` và `message_reaction`.

## Triển khai ở bước sau

Sau khi tạo D1, thay database ID, chạy migration, khai báo secret, thêm xác thực quản trị và kiểm thử staging, có thể build và triển khai bằng:

```bash
npm run build
npx wrangler deploy
```

Chưa triển khai production trong phiên bản này. Bước tiếp theo nên thay API key nền tảng bằng đăng nhập quản trị có phân quyền, đồng bộ Telegram Bot API, thêm tác vụ tổng hợp metrics theo ngày, lọc theo chat/khoảng thời gian, CSV export, retention cohorts và giám sát có loại bỏ dữ liệu nhạy cảm.
