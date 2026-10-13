# Admin Dashboard (Cloudflare $0)

Forked from `saas-admin-template`. Adds: Cloudflare Access gate, hybrid LLM chat
(SSE + durable agent facet), D1 chat logs + metrics API. See `SOURCE.md` for
clone provenance, `ROADMAP.md` for future phases.

## New routes

- `/admin/chat` — Simple tab (Workers AI SSE via `/api/chat`) + Agent tab
  (durable `ChatRoom` facet under `Orchestrator` DO, `/agents/*` -> `routeAgentRequest`)
- `/api/chat` (POST, token) — streams Kimi K2.6 via AI Gateway `llm-gw`, tees
  one row per turn into D1 `chat_logs` (session/agent/model/prompt/completion/tokens/latency)
- `/api/metrics` (GET, token) — 14d daily/agent aggregates + model totals for charts
- Agent MCP core: `Orchestrator` auto-connects 4 Cloudflare MCP servers
  (`mcp.cloudflare.com` Code Mode API + ai-gateway + observability + bindings,
  Bearer-token, idempotent, persisted in DO SQL). `POST /agents/orchestrator/admin/connect-core`,
  `GET .../mcp-state`. ChatRoom feeds `mcp.getAITools()` + `sessionAffinity` into every turn.
  Sources: `github.com/cloudflare/mcp`, `github.com/cloudflare/mcp-server-cloudflare`.

## Auth

Edge: Zero Trust Access app on `dashboard.*.workers.dev/admin*` (start previews-only).
In-Worker: `src/middleware.ts` — native `ctx.access.getIdentity()` first, jose JWT
(`Cf-Access-Jwt-Assertion`, JWKS `<team>/cdn-cgi/access/certs`, AUD tag) fallback.
Local: `wrangler.jsonc access.dev` mock + `SKIP_ACCESS=true` in `.dev.vars`.

## Extra env (beyond template API_TOKEN)

```
SKIP_ACCESS=true            # local only
TEAM_DOMAIN=https://<team>.cloudflareaccess.com
POLICY_AUD=<access-aud-tag>
CLOUDFLARE_GATEWAY_ID=llm-gw
CLOUDFLARE_API_TOKEN=<token: Workers AI Read + AI Gateway Read + account resources read>
```

Prod: `wrangler secret put API_TOKEN|TEAM_DOMAIN|POLICY_AUD|CLOUDFLARE_API_TOKEN`. CI: GH secrets
`CLOUDFLARE_API_TOKEN` (Workers Edit + Workers AI Read + AI Gateway Read/Edit +
D1 Edit) + `CLOUDFLARE_ACCOUNT_ID` via `cloudflare/wrangler-action@v4`.
Gateway `llm-gw`: cache 3600s, 20 req/min/IP, Unified Billing (zero provider keys).

## Free-tier caps enforced

Workers 100k/d + 10ms CPU, Workers AI small model + 512 tok + gateway cache,
D1 5GB (30d retention cron planned), KV sessions only, DO 2 classes max,
R2 logs-only, Access 50 seats. Details in `ROADMAP.md` ops section.

## Setup (template steps + deltas)

Deltas: `npm install` pins v6 AI chain (`ai@6` + `@ai-sdk/react@3`, enforced by
`@cloudflare/ai-chat` peer). Migrations now 0001-0004 (`npm run db:migrate`).
`wrangler types` regen needed after binding changes (`npm run cf-typegen` —
requires glibc runner, see SOURCE.md). Remote first-deploy: create
`admin-db` D1, `llm-gw` gateway, Access app, secrets, `db:migrate:remote`, deploy.

# SaaS Admin Template (upstream, kept)

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cloudflare/templates/tree/main/saas-admin-template)

![SaaS Admin Template](https://imagedelivery.net/wSMYJvS3Xw-n339CbDyDIA/52b88668-0144-489c-dd02-fe620270ba00/public)

<!-- dash-content-start -->

A complete admin dashboard template built with Astro, Shadcn UI, and Cloudflare's developer stack. Quickly deploy a fully functional admin interface with customer and subscription management capabilities.

## Features

- 🎨 Modern UI built with Astro and Shadcn UI
- 🔐 Built-in API with token authentication
- 👥 Customer management
- 💳 Subscription tracking
- 🚀 Deploy to Cloudflare Workers
- 📦 Powered by Cloudflare D1 database
- ✨ Clean, responsive interface
- 🔍 Data validation with Zod

## Tech Stack

- Frontend: [Astro](https://astro.build)
- UI Components: [Shadcn UI](https://ui.shadcn.com)
- Database: [Cloudflare D1](https://developers.cloudflare.com/d1)
- Deployment: [Cloudflare Workers](https://workers.cloudflare.com)
- Validation: [Zod](https://github.com/colinhacks/zod)

> [!IMPORTANT]
> When using C3 to create this project, select "no" when it asks if you want to deploy. You need to follow this project's [setup steps](https://github.com/cloudflare/templates/tree/main/d1-template#setup-steps) before deploying.

<!-- dash-content-end -->

## Setup Steps

1. Install dependencies:

```bash
npm install
```

2. Set up your environment variables:

```bash
# Create a .dev.vars file for local development
cp .dev.vars.example .dev.vars
```

Add your API token:

```
API_TOKEN=your_token_here
```

_An API token is required to authenticate requests to the API. You should generate this before trying to run the project locally or deploying it._

3. Create a [D1 database](https://developers.cloudflare.com/d1/get-started/) with the name "admin-db":

```bash
npx wrangler d1 create admin-db
```

...and update the `database_id` field in `wrangler.json` with the new database ID.

4. Run the database migrations locally:

```bash
$ npm run db:migrate
```

Run the development server:

```bash
npm run dev
```

_If you're testing Workflows, you should run `npm run wrangler:dev` instead._

5. Build the application:

```bash
npm run build
```

6. Deploy to Cloudflare Workers:

```bash
npm run deploy
```

7. Run the database migrations remotely:

```bash
$ npm run db:migrate:remote
```

8. Set your production API token:

```bash
npx wrangler secret put API_TOKEN
```

## Usage

This project includes a fully functional admin dashboard with customer and subscription management capabilities. It also includes an API with token authentication to access resources via REST, returning JSON data.

It also includes a "Customer Workflow", built with [Cloudflare Workflows](https://developers.cloudflare.com/workflows). This workflow can be triggered in the UI or via the REST API to do arbitrary actions in the background for any given user. See [`customer_workflow.ts`]() to learn more about what you can do in this workflow.
