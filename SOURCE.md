# SOURCE LOG — clone-first provenance (EXE1-2)
- shell: `github.com/cloudflare/templates/saas-admin-template @ main` via `npm create cloudflare@latest -- --template=cloudflare/templates/saas-admin-template` — Astro+Shadcn+D1 base, kept intact
- db pattern: `github.com/cloudflare/templates/d1-template/migrations/*.sql` -> `migrations/0004_chat_logs_pi_runs.sql` (added chat_logs, pi_runs + indexes)
- auth edge: `developers.cloudflare.com/changelog/post/2026-08-14-workers-access` -> `src/middleware.ts` ctx.access branch + `wrangler.jsonc access.dev` mock
- auth fallback: `developers.cloudflare.com/cloudflare-one/.../validating-json` (jose createRemoteJWKSet, Cf-Access-Jwt-Assertion header, NOT cookie) -> same middleware
- platform: `github.com/cloudflare/workers-sdk` wrangler@4.150.0, compat 2026-10-13, nodejs_compat dropped (>=2026-08-04 default)
- chain CORRECTION 2026-10-13: `@cloudflare/ai-chat@0.8.6` peer-enforces `@ai-sdk/react@^3` -> use v6 chain
  `ai@6.0.304 + @ai-sdk/react@3.0.307 + workers-ai-provider@3.3.1` (v4 needs ai@7, conflicts).
  installed: `agents@0.24.0 ai-chat@0.8.6 pi-durable@1.2.0 pi-ai@0.83.0 jose@6.2.12`
- env limits: workerd binary cannot spawn on this box (Alpine musl `_dl_find_object/fcntl64`) ->
  `wrangler d1 --local`, `wrangler dev`, `wrangler types` regen all blocked locally; verify in CI.
  worker-configuration.d.ts hand-synced to wrangler.jsonc; regen via `npm run cf-typegen` in CI.

## EXE3 2026-10-13 — hybrid chat
- `src/pages/api/chat.ts`: from `templates/llm-chat-app-template/src/index.ts` (raw fetch 2026-10-13).
  deltas: Astro POST shape, kimi-k2.6, max_tokens 512, gateway ON (llm-gw/cacheTtl 3600),
  D1 tee via TransformStream + waitUntil. esbuild clean. tsc: only house-style implicit-any (same as template routes).
- `src/agents/agents.js` (.js deliberate, matches wrapper .js import pattern):
  from `developers.cloudflare.com/agents/.../chat-agents` + `agents/docs/agents/sub-agents.md`.
  ChatRoom extends AIChatAgent (facet-only, exported, NOT in migrations),
  Orchestrator extends Agent (sole binding+migration v1, onBeforeSubAgent gate).
  createWorkersAI({binding, gateway}) per workers-ai-provider@3 types. full esbuild bundle exit 0.
- `src/workflows/wrapper.js`: /agents/* -> routeAgentRequest(agents@0.24.0 root export), else Astro.
  exports {CustomerWorkflow, Orchestrator, ChatRoom, pageMap}. syntax OK (entry bundle needs CI astro build).
- `wrangler.jsonc`: +durable_objects Orchestrator +migrations v1 new_sqlite_classes[Orchestrator]. valid JSON.
- `src/components/admin/chat-panel.tsx`: Simple SSE tab (llm-chat-app public/index.html pattern) +
  Agent tab useAgent(Orchestrator/admin/sub:ChatRoom/main)+useAgentChat. tsc zero errors. bundle 1.0mb.
- `src/pages/admin/chat.astro` + Header Chat link. tradeoff: API_TOKEN server-embedded in
  Access-gated page (same class as template APIDocumentation). backlog: httpOnly cookie.
- `src/pages/api/metrics.ts`: 14d daily/agent aggregates + model totals for charts. house-style types.
- docs: README delta header, ROADMAP.md (EXE4-6 + golden watchlist + ops runbook), .dev.vars.example synced.

## MCP core 2026-10-13 — Cloudflare MCP as agent tool layer
- main server repo: `github.com/cloudflare/mcp` (Code Mode: 2500 endpoints, 3 tools
  `docs/search/execute/whoami`, ~1.1k tokens, `https://mcp.cloudflare.com/mcp`, OAuth or
  Bearer API token, serves skills via MCP Skills extension, Dynamic Worker sandbox).
- product servers: `github.com/cloudflare/mcp-server-cloudflare` (ai-gateway tools
  list_gateways/list_logs/get_log_details/request/response bodies, observability, bindings...).
  All `/mcp` Streamable HTTP (spec 2026-07-28); `/sse` are aliases. New since plan:
  auditlogs, dns-analytics, dex, casb (see AGENTS.md).
- wiring: `agents/.../connect-mcp-client` guide (add-mcp/mcp-state pattern) +
  `agents@0.24.0` verified APIs: `addMcpServer(name,url,{id,transport:{type,headers}})`,
  `Agent.mcp.getAITools()` (AI SDK set, rebuilt per call), `Agent.sessionAffinity` (DO-ID
  key -> `workersai(model,{sessionAffinity})` prefix-cache), onRequest = unclaimed-paths-only.
- `src/agents/agents.js`: CORE_MCP 4 (api, ai-gateway, observability, bindings), Bearer
  `CLOUDFLARE_API_TOKEN`, stable ids, idempotent ensure; Orchestrator `connect-core` POST +
  `mcp-state` GET (slim, never leaks token); ChatRoom ensures core then
  `streamText({tools: getAITools(), sessionAffinity})`. full esbuild bundle exit 0.
- `wrapper.js`: routeAgentRequest null -> Astro fallback (guide: returns null on no match).
- UI: AgentChat MCP status line + connect button + [tool call] marker.
- secrets: `CLOUDFLARE_API_TOKEN` added (d.ts, .dev.vars(.example), README). Server-side only.
- cf CLI: official `npm:cf@1.0.0-beta.16` verified (`cli search` JSON, `docs search`,
  `d1 migrations list` CI-safe, resource cmds run alongside wrangler projects, no migrate).
  Keep `wrangler.jsonc`; cf for API/resource ops. `cf` 1.0.0-beta.16 installed global on box.
- wrangler: global 4.150.0 = npm latest; package.json range now `^4`; lockfile still
  4.136.1 (registry too slow from this box for `npm update`; CI fresh-install resolves ^4).
