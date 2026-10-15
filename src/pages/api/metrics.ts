// Aggregates over chat_logs for /admin charts. Token-authed like other /api routes.
import type { APIRoute } from "astro";
import { validateApiTokenResponse } from "@/lib/api";

export const GET: APIRoute = async ({ locals, request }) => {
  const { API_TOKEN, DB } = locals.runtime.env;

  const invalidTokenResponse = await validateApiTokenResponse(request, API_TOKEN);
  if (invalidTokenResponse) return invalidTokenResponse;

  const daily = await DB.prepare(
    `SELECT substr(created_at, 1, 10) AS day, agent, COUNT(*) AS n,
            AVG(latency_ms) AS avg_ms, SUM(tokens) AS tokens
     FROM chat_logs WHERE created_at >= date('now', '-14 days')
     GROUP BY day, agent ORDER BY day`,
  ).all();
  const models = await DB.prepare(
    `SELECT model, COUNT(*) AS n, SUM(tokens) AS tokens FROM chat_logs GROUP BY model`,
  ).all();
  const total = await DB.prepare(`SELECT COUNT(*) AS n FROM chat_logs`).first();

  return Response.json({ daily: daily.results, models: models.results, total: total?.n ?? 0 });
};
