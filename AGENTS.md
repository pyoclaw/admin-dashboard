# AGENTS.md — dashboard repo guide (clone-first, $0, edge-latest)

## Retrieval first — never trust memory for Cloudflare APIs
- Docs: `cf docs search "<question>"`, fetch result URL with `Accept: text/markdown`.
  Fallback: `https://docs.mcp.cloudflare.com/mcp` (docs MCP) or `developers.cloudflare.com/<product>/llms.txt`.
- Commands: `cf cli search "<task>"` -> pick match -> `<cmd> --help`. NEVER chain nested
  `--help` to explore. `cf schema <...>` for API request details.
- Skills: vendored in `.opencode/skills/` (agents-sdk, cf-cli, cloudflare,
  cloudflare-one, durable-objects, sandbox-next, workers-best-practices, wrangler;
  verified via `opencode debug skill`). Refresh: sparse-checkout
  `github.com/cloudflare/skills` `skills/<name>` and copy. Do NOT rely on global install.
- Project MCP config filename is `opencode.jsonc` (root, no dot). `.opencode.jsonc`
  is IGNORED (verified: `opencode debug config` empty + `mcp list` zero until renamed).
  After edits verify with `opencode debug config` + `opencode mcp list` (docs server
  connects auth-free; rest need interactive OAuth via `opencode mcp auth <name>`).

## Tool split
- `wrangler` (project, `wrangler.jsonc` — DO NOT migrate to `cloudflare.config.ts`):
  dev, deploy, d1, secret, types. Track `^4`.
- `cf` 1.x beta (`npm i -g cf`, `cf auth login`): 2900+ resource/API commands
  (`cf d1 list`, `cf ai-gateway ...`, `cf access ...`). Runs alongside Wrangler
  projects without migrating. CI auth: `CLOUDFLARE_API_TOKEN`.
- MCP (`.opencode.jsonc`): main Code Mode server runs generated code in a Dynamic
  Worker sandbox (~1k tokens / 2500 endpoints). Product servers: docs, bindings,
  builds, observability, ai-gateway. More exist (radar, containers, browser, logs,
  autorag, auditlogs, dns-analytics, dex, casb) — add only when needed (context tax).
  All at `/mcp` Streamable HTTP (MCP spec 2026-07-28); `/sse` URLs are aliases.

## MCP in-app (agent as client, verified agents@0.24.0)
- Core map lives in `src/agents/agents.js` (api Code Mode + ai-gateway + observability
  + bindings). Token transport: `addMcpServer(name, url, {id, transport: {type:
  "streamable-http", headers: {Authorization: Bearer}}})`. OAuth not needed server-side.
- `Agent.mcp.getAITools()` -> AI SDK tool set for `streamText({tools})`. Rebuilt per call.
- `this.sessionAffinity` (DO-ID key) -> `workersai(model, {sessionAffinity})`.
- Custom agent endpoints go in `onRequest` (unclaimed paths only; lifecycle keeps
  WS//sub//callbacks). `routeAgentRequest` may return null -> fall through to Astro.
- Dev config mirror: `.opencode.jsonc`. `cf` 1.x beta for resource ops alongside wrangler.

## Dynamic fetch + cache (use these, in order)
1. AI Gateway: cache (TTL 3600) + rate limit + `env.AI.gateway(id)` methods
   (`getUrl(provider)`, `patchLog` feedback). PENDING: store `env.AI.aiGatewayLogId`
   in `chat_logs.gw_log_id` (needs migration 0005 + 3 lines in `chat.ts`; see STATUS.md).
2. KV: NOT CONFIGURED (no namespace/binding yet). When added: sessions + metrics only
   (100k R / 1k W per day free, 1/sec same key). See STATUS.md missing #5.
3. D1: aggregates for charts, 30d retention. `cf d1 migrations list` shows unapplied
   as JSON without applying (CI-safe).
4. Never add Analytics Engine / extra stores on free tier without a ROADMAP entry.

## Iron rules
- Clone-first: every new file traces to an official repo in `SOURCE.md`.
- Facets: only parent in `new_sqlite_classes`; child exported from entry, never migrated.
- AI chain: `ai@6` + `@ai-sdk/react@3` (ai-chat peer). Models: kimi-k2.x family;
  never llama-3.1-8b/mistral-7b-v0.1 (deprecated 2026-05-30).
- Compat date = today on each EXE; never set `nodejs_compat` (>=2026-08-04 default).
- Box caveat: workerd can't spawn on musl (this dev box) — `dev`, `d1 --local`,
  `types` regen run in CI/glibc. `npm i` here needs `--ignore-scripts`; bins in
  node_modules/.bin may be missing — run tools via `node node_modules/<pkg>/...`.
