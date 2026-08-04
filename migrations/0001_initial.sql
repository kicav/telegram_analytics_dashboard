PRAGMA foreign_keys = ON;

CREATE TABLE admins (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE telegram_chats (id INTEGER PRIMARY KEY AUTOINCREMENT, telegram_chat_id TEXT NOT NULL UNIQUE, type TEXT NOT NULL CHECK(type IN ('group','supergroup','channel')), title TEXT NOT NULL, username TEXT, member_count INTEGER NOT NULL DEFAULT 0 CHECK(member_count >= 0), is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX idx_chats_username ON telegram_chats(username) WHERE username IS NOT NULL;

CREATE TABLE telegram_members (id INTEGER PRIMARY KEY AUTOINCREMENT, chat_id INTEGER NOT NULL REFERENCES telegram_chats(id) ON DELETE CASCADE, telegram_user_id TEXT NOT NULL, username TEXT, display_name TEXT, status TEXT NOT NULL DEFAULT 'member', joined_at TEXT, left_at TEXT, last_active_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(chat_id, telegram_user_id));
CREATE INDEX idx_members_chat_status ON telegram_members(chat_id, status);
CREATE INDEX idx_members_last_active ON telegram_members(chat_id, last_active_at);

CREATE TABLE telegram_updates (id INTEGER PRIMARY KEY AUTOINCREMENT, update_id INTEGER NOT NULL UNIQUE, update_type TEXT NOT NULL, chat_id INTEGER REFERENCES telegram_chats(id) ON DELETE SET NULL, received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, processed_at TEXT, processing_status TEXT NOT NULL DEFAULT 'received', error_code TEXT);
CREATE INDEX idx_updates_received ON telegram_updates(received_at);

CREATE TABLE member_events (id INTEGER PRIMARY KEY AUTOINCREMENT, chat_id INTEGER NOT NULL REFERENCES telegram_chats(id) ON DELETE CASCADE, member_id INTEGER REFERENCES telegram_members(id) ON DELETE SET NULL, event_type TEXT NOT NULL CHECK(event_type IN ('joined','left','active')), event_at TEXT NOT NULL, invite_link_hash TEXT, update_id INTEGER REFERENCES telegram_updates(update_id) ON DELETE SET NULL, UNIQUE(update_id, event_type, member_id));
CREATE INDEX idx_member_events_chat_date ON member_events(chat_id, event_at);

CREATE TABLE member_daily_metrics (id INTEGER PRIMARY KEY AUTOINCREMENT, chat_id INTEGER NOT NULL REFERENCES telegram_chats(id) ON DELETE CASCADE, metric_date TEXT NOT NULL, joined_count INTEGER NOT NULL DEFAULT 0, left_count INTEGER NOT NULL DEFAULT 0, active_count INTEGER NOT NULL DEFAULT 0, total_members INTEGER NOT NULL DEFAULT 0, UNIQUE(chat_id, metric_date));

CREATE TABLE posts (id INTEGER PRIMARY KEY AUTOINCREMENT, chat_id INTEGER NOT NULL REFERENCES telegram_chats(id) ON DELETE CASCADE, telegram_message_id INTEGER NOT NULL, published_at TEXT NOT NULL, content_type TEXT NOT NULL DEFAULT 'text', excerpt TEXT, author_telegram_id TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(chat_id, telegram_message_id));
CREATE INDEX idx_posts_chat_published ON posts(chat_id, published_at DESC);
CREATE TABLE post_metrics (id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE, measured_at TEXT NOT NULL, views_count INTEGER NOT NULL DEFAULT 0, forwards_count INTEGER NOT NULL DEFAULT 0, reactions_count INTEGER NOT NULL DEFAULT 0, UNIQUE(post_id, measured_at));
CREATE TABLE reactions (id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE, reaction_type TEXT NOT NULL, reaction_count INTEGER NOT NULL DEFAULT 0, measured_at TEXT NOT NULL, UNIQUE(post_id, reaction_type, measured_at));

CREATE TABLE campaigns (id INTEGER PRIMARY KEY AUTOINCREMENT, chat_id INTEGER NOT NULL REFERENCES telegram_chats(id) ON DELETE CASCADE, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','paused','completed')), starts_at TEXT, ends_at TEXT, budget REAL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(chat_id, name));
CREATE INDEX idx_campaigns_chat_status ON campaigns(chat_id, status);
CREATE TABLE campaign_invite_links (id INTEGER PRIMARY KEY AUTOINCREMENT, campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE, telegram_invite_link_hash TEXT NOT NULL UNIQUE, label TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, revoked_at TEXT);
CREATE TABLE campaign_conversions (id INTEGER PRIMARY KEY AUTOINCREMENT, campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE, invite_link_id INTEGER REFERENCES campaign_invite_links(id) ON DELETE SET NULL, member_id INTEGER REFERENCES telegram_members(id) ON DELETE SET NULL, converted_at TEXT NOT NULL, event_id INTEGER REFERENCES member_events(id) ON DELETE SET NULL, UNIQUE(campaign_id, member_id));

CREATE TABLE daily_chat_metrics (id INTEGER PRIMARY KEY AUTOINCREMENT, chat_id INTEGER NOT NULL REFERENCES telegram_chats(id) ON DELETE CASCADE, metric_date TEXT NOT NULL, total_members INTEGER NOT NULL DEFAULT 0, joined_count INTEGER NOT NULL DEFAULT 0, left_count INTEGER NOT NULL DEFAULT 0, active_7d INTEGER NOT NULL DEFAULT 0, active_30d INTEGER NOT NULL DEFAULT 0, posts_count INTEGER NOT NULL DEFAULT 0, messages_count INTEGER NOT NULL DEFAULT 0, reactions_count INTEGER NOT NULL DEFAULT 0, UNIQUE(chat_id, metric_date));
CREATE INDEX idx_daily_metrics_date ON daily_chat_metrics(metric_date DESC);

CREATE TABLE audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT, metadata_json TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
