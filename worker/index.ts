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

const toNumber = (value: unknown) => Number(value ?? 0) || 0;
const safeLimit = (value: string | undefined, fallback: number, maximum: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
};

app.get('/api/health', (c) => c.json({ status: 'ok', service: 'telegram-analytics-dashboard', timezone: c.env.APP_TIMEZONE || 'Asia/Ho_Chi_Minh' }));

app.use('/api/dashboard/*', requireAdmin);
app.use('/api/members', requireAdmin);
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
  const [latest, period] = await Promise.all([
    c.env.DB.prepare(`SELECT
      COALESCE(SUM(total_members),0) totalMembers,
      COALESCE(SUM(active_7d),0) active7d,
      COALESCE(SUM(active_30d),0) active30d
      FROM daily_chat_metrics
      WHERE metric_date=(SELECT MAX(metric_date) FROM daily_chat_metrics)`).first<Record<string, unknown>>(),
    c.env.DB.prepare(`SELECT
      COALESCE(SUM(joined_count),0) newMembers,
      COALESCE(SUM(left_count),0) leftMembers,
      COALESCE(SUM(posts_count),0) totalPosts,
      COALESCE(SUM(reactions_count),0) totalReactions
      FROM daily_chat_metrics
      WHERE metric_date >= date('now','-29 day')`).first<Record<string, unknown>>(),
  ]);
  const newMembers = toNumber(period?.newMembers);
  const leftMembers = toNumber(period?.leftMembers);
  return c.json({
    totalMembers: toNumber(latest?.totalMembers),
    newMembers,
    leftMembers,
    netGrowth: netGrowth(newMembers, leftMembers),
    active7d: toNumber(latest?.active7d),
    active30d: toNumber(latest?.active30d),
    totalPosts: toNumber(period?.totalPosts),
    totalReactions: toNumber(period?.totalReactions),
  });
});

app.get('/api/dashboard/member-growth', async (c) => {
  const result = await c.env.DB.prepare(`SELECT date,totalMembers,joined,"left" FROM (
    SELECT metric_date date,total_members totalMembers,joined_count joined,left_count AS "left"
    FROM daily_chat_metrics ORDER BY metric_date DESC LIMIT 30
  ) ORDER BY date ASC`).all();
  return c.json({ data: result.results });
});

app.get('/api/members', async (c) => {
  const limit = safeLimit(c.req.query('limit'), 100, 500);
  const search = (c.req.query('q') ?? '').trim().toLowerCase().slice(0, 80);
  const status = (c.req.query('status') ?? 'all').trim().toLowerCase();
  const allowedStatus = new Set(['all', 'member', 'administrator', 'creator', 'restricted', 'left', 'kicked']);
  const selectedStatus = allowedStatus.has(status) ? status : 'all';
  const pattern = `%${search}%`;
  const result = await c.env.DB.prepare(`SELECT
      m.id,
      COALESCE(NULLIF(m.display_name,''),NULLIF(m.username,''),'Chưa đặt tên') displayName,
      m.username,
      m.status,
      m.joined_at joinedAt,
      m.left_at leftAt,
      m.last_active_at lastActiveAt,
      c.title chatTitle
    FROM telegram_members m
    JOIN telegram_chats c ON c.id=m.chat_id
    WHERE (?='' OR LOWER(COALESCE(m.display_name,'') || ' ' || COALESCE(m.username,'') || ' ' || COALESCE(c.title,'')) LIKE ?)
      AND (?='all' OR m.status=?)
    ORDER BY COALESCE(m.last_active_at,m.joined_at,m.created_at) DESC
    LIMIT ?`)
    .bind(search, pattern, selectedStatus, selectedStatus, limit).all();
  return c.json({ data: result.results });
});

app.get('/api/posts', async (c) => {
  const limit = safeLimit(c.req.query('limit'), 20, 200);
  const search = (c.req.query('q') ?? '').trim().toLowerCase().slice(0, 100);
  const pattern = `%${search}%`;
  const result = await c.env.DB.prepare(`SELECT
      p.id,
      p.excerpt,
      p.published_at publishedAt,
      c.title chatTitle,
      COALESCE(pm.views_count,0) views,
      COALESCE(pm.reactions_count,0) reactions,
      COALESCE(pm.forwards_count,0) forwards
    FROM posts p
    JOIN telegram_chats c ON c.id=p.chat_id
    LEFT JOIN post_metrics pm ON pm.id=(SELECT id FROM post_metrics WHERE post_id=p.id ORDER BY measured_at DESC LIMIT 1)
    WHERE (?='' OR LOWER(COALESCE(p.excerpt,'') || ' ' || COALESCE(c.title,'')) LIKE ?)
    ORDER BY p.published_at DESC LIMIT ?`)
    .bind(search, pattern, limit).all();
  return c.json({ data: result.results });
});

app.get('/api/campaigns', async (c) => {
  const limit = safeLimit(c.req.query('limit'), 20, 200);
  const search = (c.req.query('q') ?? '').trim().toLowerCase().slice(0, 100);
  const pattern = `%${search}%`;
  const result = await c.env.DB.prepare(`SELECT
      c.id,
      c.name,
      c.status,
      c.starts_at startsAt,
      COUNT(DISTINCT l.id) inviteLinks,
      COUNT(DISTINCT cv.id) conversions
    FROM campaigns c
    LEFT JOIN campaign_invite_links l ON l.campaign_id=c.id
    LEFT JOIN campaign_conversions cv ON cv.campaign_id=c.id
    WHERE (?='' OR LOWER(c.name) LIKE ?)
    GROUP BY c.id
    ORDER BY c.created_at DESC LIMIT ?`)
    .bind(search, pattern, limit).all();
  return c.json({ data: result.results });
});

export default app;
