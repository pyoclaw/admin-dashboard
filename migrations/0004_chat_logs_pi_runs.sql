-- Migration number: 0004    2026-10-13 chat logs + pi runs for admin dashboard
-- SOURCE: snatched from cloudflare/templates/d1-template/migrations pattern, extended for chat_logs/pi_runs

CREATE TABLE IF NOT EXISTS chat_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    agent TEXT NOT NULL DEFAULT 'simple',
    model TEXT NOT NULL,
    prompt TEXT NOT NULL,
    completion TEXT NOT NULL DEFAULT '',
    tokens INTEGER NOT NULL DEFAULT 0,
    latency_ms INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_chat_logs_session ON chat_logs(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_logs_created ON chat_logs(created_at);

CREATE TABLE IF NOT EXISTS pi_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    result TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_pi_runs_created ON pi_runs(created_at);
