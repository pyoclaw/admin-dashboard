# STATUS — done vs missing vs unclear (audited 2026-10-13, code-read + package-verify)

> See `AUDIT.md` for the critical security/planning review. Top open risks:
> R1 agent holds mutable infra token · P1 free-tier budget never computed ·
> R5 Access-vs-CI deploy path unverified · P6 migrations never executed.

Legend: `[L]` proven on this box (esbuild/tsc/json/grep) · `[D]` needs deploy/runtime proof.

## DONE [L]
- Shell scaffold, `wrangler.jsonc` (compat 2026-10-13, traces, access.dev mock, AI+DO
  bindings, v1 migration), 0004 migration, middleware (ctx.access -> SKIP -> jose),
  `/api/chat` (SSE+gateway+D1 tee), `/api/metrics`, agents.js (facet rules, MCP core,
  getAITools, sessionAffinity), wrapper /agents routing + null fallback, chat UI
  (both tabs, MCP status/connect), Header link, `.opencode.jsonc` (6 MCP),
  AGENTS.md, README delta, ROADMAP, SOURCE provenance.
- SDK facts verified in `node_modules`: routeAgentRequest root export, addMcpServer
  token-transport overload, `Agent.mcp.getAITools()`, `sessionAffinity` getter +
  provider option, `Ai.aiGatewayLogId` + `Ai.gateway(id)`, onRequest=unclaimed-only
  contract, useAgentChat `status`/`sendMessage`, Code Mode README (token auth, skills ext).
- Secrets git-safe: `.dev.vars*` ignored, example synced. wrangler range `^4`
  (global 4.150.0 = npm latest verified). `cf` beta.16 installed, discovery verified.

## DONE [D] (code complete, zero runtime proof — first deploy must check)
- `dist` build, wrapper entry bundle, DO binding + facet spawn, WS chat turn with MCP
  tools, MCP token-auth handshake, D1 remote migrate (0001-0004), Access edge policy,
  secrets set, `useAgent` sub-route shape `/agents/orchestrator/admin/...`,
  Kimi model IDs accepted, `toUIMessageStreamResponse` with tools.

## MISSING — roadmapped (ROADMAP EXE4/5/6, correct)
- `/admin/pi` PiHarness gadget (deps installed, unused) · metrics charts page (API only) ·
  30d retention cron + R2 · Issues/Automations->PR loop · httpOnly cookie (token in
  browser accepted) · openauth fallback · tests (`@cloudflare/vitest-pool-workers`) ·
  CI workflow (`wrangler-action`) · Sandbox/WebSearch/402 opt-ins.

## MISSING — NOT roadmapped (new from this audit)
1. **`/agents/*` has no auth.** Middleware gates `/admin*` only; `/api/*` has API_TOKEN
   but agent routes (WS chat, connect-core, mcp-state) check nothing. Fix EXE6:
   token-check in wrapper fetch OR widen Access app to `/agents/*` + `/api/*`.
2. **No git repo.** `git init` + initial commit + push remote never done. Do first.
3. **No CI.** No `.github/` workflows. Needed for: typecheck, `cf-typegen`, `db:migrate`,
   `deploy --dry-run`, wrangler lock refresh (stuck 4.136.1; registry unreachable here).
4. **`gw_log_id` gap.** AGENTS.md rule #1 orders `aiGatewayLogId -> chat_logs.gw_log_id`
   but no migration 0005 exists and `chat.ts` doesn't capture it. Binding API confirmed
   (`Ai.aiGatewayLogId: string | null`). Fix: 1 migration + 3 lines + header. Smallest EXE5 item.
5. **KV sessions unconfigured.** AGENTS.md rule #2 assumes KV; no namespace/binding exists.
   Either create it or downgrade rule to "metrics cache only if KV added".
6. **`x-session-affinity` on `/api/chat`.** Agent path has it (provider option); raw
   `AI.run` SSE path doesn't (binding equivalent unverified — see Unclear #3).
7. **D1 `database_id` is the template placeholder.** Real `d1 create` + ID swap is a
   deploy blocker; README covers it but nothing tracks completion.
8. **Package name still `saas-admin-template`.** Rename on first stable deploy.

## UNCLEAR — needs research or runtime proof (do not assert in docs)
1. Template `wrapper.js` imports `../src/workflows/customer_workflow.js` but repo file is
   `.ts`. Ours is real `.js` (safe); whether wrangler resolves template's `.js->.ts`
   is proven only by CI deploy. If deploy fails, rename to `.js` or fix import.
2. `ChatRoom` facet reachable at `/agents/orchestrator/admin/sub/chat/main` per sub-agent
   docs, but no live WS handshake observed. First WS test must confirm (else routing bug).
3. Raw-binding session affinity: blog shows REST `x-session-affinity` header;
   `workers-ai-provider` option covers provider path only. Check binding `run()` options
   for affinity support; else route `/api/chat` through provider or accept lower hit rate.
4. Kimi IDs (`k2.6`, `k2.7-code`) sourced from docs examples + deprecation thread, never
   executed. A wrong ID fails at runtime — first `/api/chat` call is the test.
5. `cf` drift: box has beta.16, docs snapshot said beta.5 (stale). Re-run
   `cf --version` + `npm view cf version` from a fast network before scripting CI on it.
6. `.opencode.jsonc` never loaded (`opencode mcp list` needs interactive OAuth; CI can't).
   Manual verify on a dev machine.
7. Template README references `npm run wrangler:dev` (no such script; actual: `preview` /
   `e2e:dev`). Upstream doc bug, kept verbatim — don't copy that line into our docs.

## DOC TRUTHS FIXED WITH THIS AUDIT
- AGENTS.md rule #1: `gw_log_id` + `gateway()` methods marked aspirational (see Missing #4),
  not current behavior. KV rule flagged pending (Missing #5).
- 2026-10-13 opencode pass: 8 skills vendored+discovered, `opencode.jsonc` filename fix
  (dot-file ignored), 6 MCP registered. AGENTS.md/SOURCE.md updated.
