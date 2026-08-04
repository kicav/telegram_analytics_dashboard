export interface Env {
  DB: D1Database;
  TELEGRAM_WEBHOOK_SECRET: string;
  ADMIN_API_KEY: string;
  APP_TIMEZONE: string;
}

export interface TelegramUpdate {
  update_id: number;
  chat_member?: { chat: TelegramChat; from: TelegramUser; new_chat_member: { user: TelegramUser; status: string }; old_chat_member: { status: string }; invite_link?: { invite_link: string } };
  message?: TelegramMessage;
  channel_post?: TelegramMessage;
  message_reaction?: { chat: TelegramChat; message_id: number; user?: TelegramUser; date: number; old_reaction: unknown[]; new_reaction: unknown[] };
}
export interface TelegramChat { id: number; type: string; title?: string; username?: string }
export interface TelegramUser { id: number; username?: string; first_name: string; last_name?: string }
export interface TelegramMessage { message_id: number; date: number; chat: TelegramChat; from?: TelegramUser; text?: string; caption?: string }
