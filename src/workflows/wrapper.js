// This is a wrapper file for exporting both the Astro application as well as
// the CustomerWorkflow class. This is necessary because Astro does not allow
// us to manually export non-Astro stuff as part of the bundle file.
// SOURCE delta 2026-10-13: added agent entry wiring. /agents/* -> routeAgentRequest
// (agents SDK), everything else -> Astro. Orchestrator = bound parent DO,
// ChatRoom = facet-only child (exported for ctx.exports, NOT in migrations).
import astroEntry, { pageMap } from "./_worker.js/index.js";
import { CustomerWorkflow } from "../src/workflows/customer_workflow.js";
import { Orchestrator, ChatRoom } from "../src/agents/agents.js";
import { routeAgentRequest } from "agents";

function astroFetch(request, env, ctx) {
  if (astroEntry && typeof astroEntry.fetch === "function") {
    return astroEntry.fetch(request, env, ctx);
  }
  return astroEntry(request, env, ctx);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/agents/")) {
      // routeAgentRequest returns null when no agent route matches -> fall through.
      const routed = await routeAgentRequest(request, env);
      if (routed) return routed;
    }
    return astroFetch(request, env, ctx);
  },
};
export { CustomerWorkflow, Orchestrator, ChatRoom, pageMap };
