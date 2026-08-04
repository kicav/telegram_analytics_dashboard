import { Hono, type MiddlewareHandler } from 'hono';
import { netGrowth } from './analytics';
import type { Env, TelegramUpdate } from './types';
import { classify, processUpdate } from './webhook';

type AppBindings = { Bindings: Env };
export const app = new Hono<AppBindings>();

const requireAdmin: MiddlewareHandler<AppBindings> = async (c, next) => {
  const apiKey = c.req.header('X-Admin-Api-Key');
  if (!c.env.ADMIN_API_KEY || apiKey !== c.env.ADMIN_API_KEY) {
    return c.json({ error: 'Không có quyền truy cập' }, 401);
  }
  await next();
};

app.get('/api/health', (c) => c.json({ status: 'ok', service: 'telegram-analytics-dashboard', timezone: c.env.APP_TIMEZONE || 'Asia/Ho_Chi_Minh' }));

app.use('/api/dashboard/*', requireAdmin);
app.use('/api/posts', requireAdmin);
app.use('/api/campaigns', requireAdmin);

app.post('/api/telegram/webhook', async (c) => {
  const supplied = c.req.header('X-Telegram-Bot-Api-Secret-Token');
  if (!c.env.TELEGRAM_WEBHOOK_SECRET || supplied !== c.env.TELEGRAM_WEBHOOK_SECRET) return c.json({ error: 'Webhook không hợp lệ' }, 401);
  let update: TelegramUpdate;
  try { update = await c.req.json<TelegramUpdate>(); } catch { return c.json({ error: 'JSON không hợp lệ' }, 400); }
  if (!Number.isSafeInteger(update.update_id)) return c.json({ error: 'Thiếu update_id hợp lệ' }, 400);
  const inserted = await c.env.DB.prepare('INSERT OR IGNORE INTO telegram_updates (update_id,update_type) VALUES (?,?)').bind(update.update_id, classify(update)).run();
  if (!inserted.meta.changes) return c.json({ ok: true, duplicate: true });
  try { await processUpdate(update, c.env); } catch {
    await c.env.DB.prepare("UPDATE telegram_updates SET processing_status='failed',error_code='PROCESSING_ERROR' WHERE update_id=?").bind(update.update_id).run();
    return c.json({ error: 'Không thể xử lý update' }, 500);
  }
  return c.json({ ok: true, duplicate: false });
});

app.get('/api/dashboard/overview', async (c) => {
  const row = await c.env.DB.prepare(`SELECT COALESCE(SUM(total_members),0) totalMembers,COALESCE(SUM(joined_count),0) newMembers,COALESCE(SUM(left_count),0) leftMembers,COALESCE(SUM(active_7d),0) active7d,COALESCE(SUM(active_30d),0) active30d,COALESCE(SUM(posts_count),0) totalPosts,COALESCE(SUM(reactions_count),0) totalReactions FROM daily_chat_metrics WHERE metric_date=(SELECT MAX(metric_date) FROM daily_chat_metrics)`).first<Record<string, number>>();
  const data = row ?? { totalMembers: 0, newMembers: 0, leftMembers: 0, active7d: 0, active30d: 0, totalPosts: 0, totalReactions: 0 };
  return c.json({ ...data, netGrowth: netGrowth(data.newMembers ?? 0, data.leftMembers ?? 0) });
});
app.get('/api/dashboard/member-growth', async (c) => c.json({ data: (await c.env.DB.prepare('SELECT metric_date date,total_members totalMembers,joined_count joined,left_count left_count FROM daily_chat_metrics ORDER BY metric_date DESC LIMIT 30').all()).results.reverse() }));
app.get('/api/posts', async (c) => c.json({ data: (await c.env.DB.prepare(`SELECT p.id,p.excerpt,p.published_at publishedAt,c.title chatTitle,COALESCE(pm.views_count,0) views,COALESCE(pm.reactions_count,0) reactions FROM posts p JOIN telegram_chats c ON c.id=p.chat_id LEFT JOIN post_metrics pm ON pm.id=(SELECT id FROM post_metrics WHERE post_id=p.id ORDER BY measured_at DESC LIMIT 1) ORDER BY p.published_at DESC LIMIT 20`).all()).results }));
app.get('/api/campaigns', async (c) => c.json({ data: (await c.env.DB.prepare(`SELECT c.id,c.name,c.status,c.starts_at startsAt,COUNT(DISTINCT l.id) inviteLinks,COUNT(DISTINCT cv.id) conversions FROM campaigns c LEFT JOIN campaign_invite_links l ON l.campaign_id=c.id LEFT JOIN campaign_conversions cv ON cv.campaign_id=c.id GROUP BY c.id ORDER BY c.created_at DESC`).all()).results }));

export default app;
