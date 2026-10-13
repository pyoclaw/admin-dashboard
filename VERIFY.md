# VERIFY — hallucination audit, 2026-10-13. Every claim below was executed, not recalled.

## Method
- Packages: `require(<pkg>/package.json).version` on disk (npm only writes these after
  registry download → existence proven) + entry-point file check + live `import('jose')`.
- Remotes: `curl` status codes (200 = exists, 401 on MCP = live + auth-gated, correct).
- SDK APIs: `grep` in installed `node_modules` `.d.ts`/`.js` with file:line noted.
- Box versions: `--version` re-run today.

## Packages: 32/32 present, ranges satisfied
Critical chain (v6 lock proven by ai-chat peer block
`{"@ai-sdk/react":"^3.0.204","agents":">=0.16.0 <1.0.0","ai":"^6.0.0","react":"^19.0.0","zod":"^4.0.0"}`):
`agents@0.24.0` ✓ · `@cloudflare/ai-chat@0.8.6` ✓ · `ai@6.0.304` ✓ ·
`@ai-sdk/react@3.0.307` ✓ · `workers-ai-provider@3.3.1` ✓ ·
`@earendil-works/pi-durable@1.2.0` ✓ · `@earendil-works/pi-ai@0.83.0` ✓ ·
`jose@6.2.12` ✓ (live import: jwtVerify + createRemoteJWKSet are functions) ·
`react@19.2.1` ✓ · `zod@4.1.13` ✓ · `wrangler@4.136.1` satisfies `^4` ✓ (lock refresh pending CI).
Remaining 21 (astro 5.16.9, @astrojs/*, radix x5, tanstack 8.21.3, lucide 0.555.0,
tailwindcss 3.4.19, etc.): version read from disk, entry files spot-checked.
No `MISSING` rows. jose layout is `dist/webapi` (not `dist/index.js`) — check correctly.

## Remotes: 7×200, 5×401-expected
`github.com/cloudflare/{templates,agents-starter,agents,mcp-server-cloudflare,cf}` 200 ·
raw `templates/.../llm-chat-app-template/src/index.ts` 200 (content vendored into chat.ts) ·
raw `cloudflare/mcp` README 200 (Code Mode claims sourced) ·
`{mcp,bindings,builds,observability,ai-gateway}.mcp.cloudflare.com/mcp` 401 =
live + auth-gated ✓ · docs MCP additionally proven connected via `opencode mcp list`.
`cloudflare-os` / `opencode-worker` appear in docs as named non-goals only (no URLs claimed).

## Box CLIs (re-run today)
`wrangler 4.150.0` (= npm latest as of 2026-10-13) · `cf 1.0.0-beta.16` ·
`opencode 1.19.0` · `node v24.18.1`. `cf` beta drifts fast — re-check before scripting CI.

## SDK APIs (file:line evidence in installed tree)
- `routeAgentRequest` root export: `agents/dist/index.d.ts:212` (+ null-fallback per
  official connect-mcp-client guide code).
- `addMcpServer(name,url,{id,transport:{type,headers}})` overload + `{id,state,authUrl?}`
  union: `agents/dist/agent-routing-B2XLNMxq.d.ts:6590`.
- `Agent.mcp: MCPClientManager`, `getAITools()` ("tools you can use with the AI SDK"):
  same file `:4649`, `:getAITools` block. `unstable_getAITools` deprecated — we use current.
- `Agent.sessionAffinity` getter + provider `sessionAffinity` option:
  same file `:4672`, `workers-ai-provider/dist/index.d.mts:132`.
- `onRequest` = unclaimed-paths-only: same file `:4496` + lifecycle `:991` fall-through.
- `Ai.aiGatewayLogId: string | null`, `Ai.gateway(id)`: `worker-configuration.d.ts:10517`.
- `ExecutionContext.access?: CloudflareAccessContext`: same file `:444`.
- `useAgentChat` returns `status`/`sendMessage`: `@cloudflare/ai-chat/dist/react.d.ts`.
- Facet rules (parent-only migration, export-from-entry, no `Sub` name, no independent
  alarms): vendored `agents-sdk` skill + `docs/agents/sub-agents.md` (plan research).

## Deliberately DOWNGRADED (sourced, not executable here — see STATUS.md Unclear)
- Kimi IDs (`k2.6`, `k2.7-code`): docs examples + deprecation thread only. First live call decides.
- Free-tier numbers (100k/d, KV 100k/1k, DO 5GB, R2 10GB, 50 seats): docs excerpts, as-of Oct 2026.
- `cf` "latest": never claimed; only installed beta.16 recorded.
- `.opencode.jsonc` advice from upstream docs was WRONG here (ignored file); corrected
  empirically to `opencode.jsonc`. Upstream docs can be stale — this file is the proof log.
