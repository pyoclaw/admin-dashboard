# ROADMAP — future goals, phased. $0 constraint holds unless marked $$.

## EXE4 — Pi gadget (embedded durable coding runs)
- `PiHarness` beta (`agents/harness/pi`, changelog 2026-10-02): `src/agents/PiAgent.ts`
  parent DO + `pi-durable@1.x` + `pi-ai@0.83.x`, model kimi-k2.7-code.
- Pi is fetch-only: HTTPS `.../ai/v1` Bearer, never WORKERS_AI binding. If gateway set,
  `CF_AI_GATEWAY_ACCOUNT_ID + CF_AI_GATEWAY_API_TOKEN` required. Leave `options.fetch` seam.
- `/admin/pi` page: task input + `pi_runs` list (table exists since 0004).
- Verify: interruption mid-turn resumes (kill DO, re-query). Cap concurrent runs (CPU).

## EXE5 — charts + retention + Issues loop
- `/admin/metrics` page: Shadcn charts on `/api/metrics` (daily turns/tokens/latency,
  model split) + link AI Gateway User Insights (free task/model/turn/user + savings).
- Retention cron (CustomerWorkflow pattern): `DELETE chat_logs < 30d` -> R2 archive.
  Add `[[r2_buckets]]` only then.
- Workers Issues beta + Automations -> Pi agent -> PR (`cf` CLI). One-line config,
  `tracing` ctx for user/session IDs. Review PRs before deploy, mark resolved.
- Traces: keep 2 custom spans (`chat.turn`, `pi.run`), sample (paid from 2026-10-01).

## EXE6 — auth hardening
- httpOnly session cookie for `/api/*`, drop browser-embedded API_TOKEN (current:
  server-embedded in Access-gated page, accepted single-admin tradeoff).
- Optional public surface later: `openauth-template` (D1+KV) — backlog only.

## Golden watchlist (re-evaluate monthly, pin on adopt)
- [ ] AI Gateway Web Search API beta -> Pi grounding tool
- [ ] Sandbox SDK 1.0 migration (`sandbox-next` skill; 0.x EOL 2026-12-31) if preview pane wanted
- [ ] Per-Worker scoped CI roles (replace account-wide token)
- [ ] D1 read replicas for `/api/metrics` if slow
- [ ] Model deprecations: never pin llama-3.1-8b/mistral-7b-v0.1 class (dead 2026-05-30);
      track kimi-k2.x / glm-flash / gemma-4-26b pricing
- [ ] `x-session-affinity` header on chat calls (prefix-cache discount; starter wires it)
- [ ] Kitesurf agent-browser, Machine Payments x402, Clef/Threat Signals — skip unless need

## Explicit non-goals
Full `cloudflare-os` fork, `opencode-worker` deploy, Analytics Engine, Stripe billing,
`Artifacts` (Paid-only). Revisit only on paid upgrade.

## Ops runbook
- Daily: Gateway logs + User Insights savings hints; D1 size (`SELECT page_count...` or dashboard).
- On 1027 (100k/d): tighten gateway rate limit, extend cache TTL. On 1102 (CPU): cut
  max_tokens, strip agent tools. On D1 limit errors (enforced 2026-09-01): run retention early.
- Model 401 code 10000: token lacks Workers AI Read (Gateway perm alone insufficient).
- `wrangler types` + `d1 --local` + `dev` need glibc runner (this repo's box is musl; use CI).
- Compat date: bump to today on each EXE, never re-add `nodejs_compat` (>=2026-08-04 default).
