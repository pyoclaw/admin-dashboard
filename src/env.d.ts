type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

// Must live outside App.Locals: these are Worker-level secrets consumed via
// locals.runtime.env, not request-scoped locals. Augments the generated
// global `interface Env` in worker-configuration.d.ts (wrangler typegen omits
// secrets: they're set via `wrangler secret put`).
interface Env {
  API_TOKEN: string;
}

declare namespace App {
  interface Locals extends Runtime {
    CUSTOMER_WORKFLOW: Workflow;
    DB: D1Database;
  }
}
