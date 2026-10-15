// Augments the generated `Env` (worker-configuration.d.ts), which lacks API_TOKEN.
interface Env {
  API_TOKEN: string;
}

type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

declare namespace App {
  interface Locals extends Runtime {
    CUSTOMER_WORKFLOW: Workflow;
    DB: D1Database;
  }
}
