-- Migration number: 0005    2026-10-13 gateway log join key (see STATUS.md missing #4)
-- SOURCE: Ai.aiGatewayLogId (workers runtime types, verified in worker-configuration.d.ts)

ALTER TABLE chat_logs ADD COLUMN gw_log_id TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_chat_logs_gw ON chat_logs(gw_log_id);
