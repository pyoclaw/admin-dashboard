# AUDIT — critical review of my own plan & build. 2026-10-13. Blunt on purpose.

Auditor stance: assume my plan was written by someone who had not yet tried to ship it.
What follows is what that person got wrong. Fixed items marked ✅.

---

## PART 1 — SECURITY (worst problems first)

### R1. CRITICAL — The chat agent holds an account-scoped Cloudflare API token, and the model can execute code against it.
`agents.js` gives ChatRoom a `CLOUDFLARE_API_TOKEN` and wires `mcp.getAITools()` into every
turn. One of those tools is Code Mode `execute`, which can call any endpoint the token allows.
So: **anyone who can type into the admin chat can mutate infrastructure** — deploy a Worker,
delete D1 rows, change DNS — via prompt injection or a stray instruction. The Access gate
protects against anonymous users; it does nothing against the logged-in admin being coerced,
and it does nothing about a hijacked session or a malicious tool result.

This is the single worst design decision in the plan, and the plan never once named it as a risk.

Mitigations (need choosing, not more research):
- **Scope the token down** to read-only + AI Gateway (Account Analytics Read, Workers Scripts
  Read, D1 Read, AI Gateway Read). Code Mode then cannot mutate anything.
- **Drop `cloudflare-api` from the chat toolset entirely.** Keep `ai-gateway` (log reads) +
  `observability`. Keep the full API MCP only for `cf`-driven operator work, not the LLM.
- Or gate it: a `POST /agents/orchestrator/admin/arm-api-mcp` that flips a flag with a short
  expiry before mutating calls are allowed.

**Recommended: read-only token + remove cf-api from the chat toolset.** Costs nothing, keeps 90% of the value.

### R2. HIGH — No rate limiting on `/api/chat` or the agent endpoints.
Gateway 20/min/IP helps inference, but nothing bounds *request* volume or per-user burn.
An authenticated actor (or a bug/loop) can drain the daily neuron quota before 00:00 UTC and
the app is dead until midnight. Free-tier plans fail closed, so this is a self-inflicted outage.

### R3. MEDIUM — `API_TOKEN` is rendered into the page and shipped to the browser.
Acknowledged in code comments and deferred to EXE6, but it is a token that grants full D1 CRUD
via `/api/*`. XSS ⇒ full data access. Access gate reduces blast radius; it does not fix it.

### R4. MEDIUM — No CSP, no security headers, no Turnstile.
Admin surface with zero CSP. Cheap to add in the wrapper's fetch path.

### R5. MEDIUM — Unknown whether CI/CLI can talk to an Access-protected Worker. Never researched.
I wrote one line in planning ("wrangler must authenticate with Access for remote bindings")
and then never resolved it. `wrangler deploy` / `d1 migrations apply` against a Worker behind
an Access app may 302 to a login page and fail confusingly. Needs: Service Auth policy on the
Access app for a CI service token, or an Access bypass for the token. **Untested = deploy day risk.**

### R6. LOW — `chat_logs` stores full prompts and completions with no retention enforcement.
30-day cleanup was planned in EXE5 and never built. Today the table grows unbounded toward the
5GB D1 free cap, which fails *reads and writes* for the whole account. Self-inflicted
denial-of-service with a 30-day fuse.

### R7. LOW — Secrets live in a Durable Object env and are reachable by agent code.
Acceptable *if* R1 is fixed (read-only token). Fatal if not.

---

## PART 2 — PLANNING DEFECTS

### P1. The free-tier budget was never actually calculated. It was asserted.
I wrote "~10k neurons/day" and "512 tokens" and moved on. No model of:
neurons per request × turns per day × retention. So I cannot answer "how many chat turns can
this app serve for $0", which is the entire premise of the project. **This is the biggest
planning hole.** It must be a table, not a vibe.

### P2. P1 compounds with a bad model choice: the "budget-minded" plan picked a frontier model.
`@cf/moonshotai/kimi-k2.6` is a 256k-context frontier model. Quota burn per request is
orders of magnitude above `@cf/zai-org/glm-4.7-flash`. For a *single-admin monitoring
dashboard*, frontier is unjustified. No benchmark was ever run. I optimized for demo
impression over the stated constraint.

### P3. No acceptance criteria. "Done" is whatever I declared done.
EXE4/5/6 have no binary tests. STATUS.md's DONE[D] list is a to-verify list, not a
definition of done. A long task without exit criteria cannot finish.

### P4. No requirements or user stories anywhere.
Who reads these chat logs? What decision does the dashboard drive? What is the alert that
matters? Nobody specified. I built a specified-as-nothing because I never asked.

### P5. No staging/preview environment defined.
`wrangler.jsonc` has no `env.*`. PRs currently deploy nowhere (safe), but Workers Previews,
preview D1, and per-env bindings were researched and never implemented. First real
"test before prod" story is absent.

### P6. Migrations have no down path and have never been executed.
`0005` is an `ALTER TABLE ADD COLUMN`. It has never been applied anywhere — workerd cannot run
on this box, so not even locally. deploy.yml runs migrations *before* deploy; a failed
migration bricks the pipeline, and there is no documented recovery.

### P7. Reproducibility: vendored skills came from a moving branch.
`.opencode/skills/` was sparse-cloned from `cloudflare/skills@main` with **no commit SHA
recorded**. Tomorrow's clone is a different tree. Supply-chain and audit gap; I claimed
"verified" without pinning.

### P8. Vendored skills contradict my own AGENTS.md in places.
The `wrangler` skill says: *"for a new project use the cf CLI, do not add Wrangler."*
My project deliberately keeps `wrangler.jsonc`. The skill will fight my documented decision.
I should either note the exception in AGENTS.md or accept the conflict silently (current state:
silent).

---

## PART 3 — RESEARCH GAPS FOR THE LONG TASK

| # | Unresearched question | Why it blocks | Cost to answer |
|---|---|---|---|
| L1 | Do Kimi K2.6 / K2.7-code exist in the live catalog, and at what neuron cost? | Wrong ID = 500 on first call; wrong pick = budget blown | 10 min against the live catalog |
| L2 | Does the binding's `AI.run` accept a session-affinity option (not just the provider)? | `/api/chat` may be paying full price for cached prefixes | 20 min in worker-types + docs |
| L3 | Can a Workers Previews URL be Access-protected without locking myself out? | Previews are public by default; the dashboard would leak | 30 min |
| L4 | Actual D1 read/write cost of `/api/metrics` at 14 days of rows | Free tier fails *closed* on daily row reads (2026-09-01 change) | 30 min, measure |
| L5 | PiHarness beta API churn rate | It is explicitly beta and "will likely change"; EXE4 could be rewritten weekly | ongoing |
| L6 | Cost/latency of glm-4.7-flash vs kimi-k2.6 for this exact workload | decides P2 | 1 hr benchmark |
| L7 | Behaviour at 10× scale (10 admins, 10 D1s, 100k req/day) | $0 plan collapses here; nobody knows where the cliff is | design pass |
| L8 | Whether Workers Logs retention/sampling can keep observability under billing | Traces bill from 2026-10-01 | 30 min |

---

## PART 4 — WHAT I GOT RIGHT (kept short, so it stays credible)

- Facet/DO topology is correct and matches the sub-agent rules exactly (parent-only migration,
  exported child, `onBeforeSubAgent` gate). This is the hardest part and it's right.
- Access-first auth with `ctx.access` and a dev mock was the right call over hand-rolled users.
- Provenance discipline (SOURCE/VERIFY/STATUS) caught a real config bug and a real filename bug.
  That is exactly what those files were for, and they paid for themselves.
- Choosing `ai@6` because a peer dependency *forced* it, rather than forcing my preference.
- Cloning first and writing deltas, instead of rebuilding the admin shell.

---

## PART 5 — FIXED IN THIS PASS ✅

1. **CI was broken and would have failed on the first PR.** Every step pointed at
   `dashboard/`, but the repo root *is* the app. Every job would have died instantly.
2. **CI was guaranteed red anyway:** `tsc --noEmit` has ~112 errors (109 inherited from the
   template, plus my own files). Now: `typecheck:owned` blocks on files I authored (after
   `astro sync` so `astro:middleware` types exist), full typecheck runs informational.
   `astro build` + dry-run are the real gates.

Still open and *deliberately* not done without a decision: R1 (token scope), R5 (Access vs CI).