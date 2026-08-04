import { describe, expect, it } from 'vitest';
import { app } from '../worker';
import type { Env } from '../worker/types';

const baseEnv = { APP_TIMEZONE: 'Asia/Ho_Chi_Minh', TELEGRAM_WEBHOOK_SECRET: 'test-secret', ADMIN_API_KEY: 'admin-test-key' } as Env;

describe('API nền tảng', () => {
  it('trả về trạng thái health', async () => {
    const response = await app.request('/api/health', {}, baseEnv);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'ok', timezone: 'Asia/Ho_Chi_Minh' });
  });

  it('từ chối webhook không có secret hợp lệ', async () => {
    const response = await app.request('/api/telegram/webhook', { method: 'POST', body: JSON.stringify({ update_id: 1 }) }, baseEnv);
    expect(response.status).toBe(401);
  });

  it.each(['/api/dashboard/overview', '/api/dashboard/member-growth', '/api/posts', '/api/campaigns'])('bảo vệ endpoint quản trị %s', async (path) => {
    const response = await app.request(path, {}, baseEnv);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Không có quyền truy cập' });
  });

  it('bỏ qua update_id trùng', async () => {
    const statement = { bind: () => statement, run: async () => ({ meta: { changes: 0 } }) };
    const env = { ...baseEnv, DB: { prepare: () => statement } as unknown as D1Database };
    const response = await app.request('/api/telegram/webhook', { method: 'POST', headers: { 'X-Telegram-Bot-Api-Secret-Token': 'test-secret', 'Content-Type': 'application/json' }, body: JSON.stringify({ update_id: 123, message: { message_id: 1, date: 1, chat: { id: -1, type: 'supergroup' } } }) }, env);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, duplicate: true });
  });
});
