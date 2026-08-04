import type { Env, TelegramChat, TelegramMessage, TelegramUpdate } from './types';

const classify = (update: TelegramUpdate) => update.chat_member ? 'chat_member' : update.channel_post ? 'channel_post' : update.message ? 'message' : update.message_reaction ? 'message_reaction' : 'unknown';

async function ensureChat(db: D1Database, chat: TelegramChat): Promise<number> {
  await db.prepare(`INSERT INTO telegram_chats (telegram_chat_id,type,title,username) VALUES (?,?,?,?)
    ON CONFLICT(telegram_chat_id) DO UPDATE SET title=excluded.title,username=excluded.username,updated_at=CURRENT_TIMESTAMP`)
    .bind(String(chat.id), chat.type === 'channel' ? 'channel' : chat.type === 'group' ? 'group' : 'supergroup', chat.title ?? 'Chưa đặt tên', chat.username ?? null).run();
  const row = await db.prepare('SELECT id FROM telegram_chats WHERE telegram_chat_id=?').bind(String(chat.id)).first<{ id: number }>();
  if (!row) throw new Error('CHAT_NOT_FOUND');
  return row.id;
}

async function recordMessage(db: D1Database, message: TelegramMessage, isPost: boolean): Promise<number> {
  const chatId = await ensureChat(db, message.chat);
  if (isPost) {
    const excerpt = (message.text ?? message.caption ?? '').slice(0, 160) || null;
    await db.prepare('INSERT OR IGNORE INTO posts (chat_id,telegram_message_id,published_at,content_type,excerpt,author_telegram_id) VALUES (?,?,?,?,?,?)')
      .bind(chatId, message.message_id, new Date(message.date * 1000).toISOString(), message.text ? 'text' : 'media', excerpt, message.from ? String(message.from.id) : null).run();
  }
  return chatId;
}

export async function processUpdate(update: TelegramUpdate, env: Env): Promise<void> {
  let chatId: number | null = null;
  if (update.chat_member) {
    const event = update.chat_member;
    chatId = await ensureChat(env.DB, event.chat);
    const user = event.new_chat_member.user;
    const left = ['left', 'kicked'].includes(event.new_chat_member.status);
    await env.DB.prepare(`INSERT INTO telegram_members (chat_id,telegram_user_id,username,display_name,status,joined_at,left_at)
      VALUES (?,?,?,?,?,?,?) ON CONFLICT(chat_id,telegram_user_id) DO UPDATE SET status=excluded.status,joined_at=COALESCE(telegram_members.joined_at,excluded.joined_at),left_at=excluded.left_at,updated_at=CURRENT_TIMESTAMP`)
      .bind(chatId, String(user.id), user.username ?? null, [user.first_name, user.last_name].filter(Boolean).join(' '), left ? 'left' : event.new_chat_member.status, left ? null : new Date().toISOString(), left ? new Date().toISOString() : null).run();
    const member = await env.DB.prepare('SELECT id FROM telegram_members WHERE chat_id=? AND telegram_user_id=?').bind(chatId, String(user.id)).first<{ id: number }>();
    await env.DB.prepare('INSERT OR IGNORE INTO member_events (chat_id,member_id,event_type,event_at,invite_link_hash,update_id) VALUES (?,?,?,?,?,?)')
      .bind(chatId, member?.id ?? null, left ? 'left' : 'joined', new Date().toISOString(), event.invite_link ? await hashInvite(event.invite_link.invite_link) : null, update.update_id).run();
  } else if (update.channel_post) chatId = await recordMessage(env.DB, update.channel_post, true);
  else if (update.message) chatId = await recordMessage(env.DB, update.message, false);
  else if (update.message_reaction) chatId = await ensureChat(env.DB, update.message_reaction.chat);
  await env.DB.prepare("UPDATE telegram_updates SET chat_id=?,processed_at=CURRENT_TIMESTAMP,processing_status='processed' WHERE update_id=?").bind(chatId, update.update_id).run();
}

async function hashInvite(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export { classify };
