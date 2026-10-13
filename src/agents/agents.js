// SOURCES:
// - main MCP server: github.com/cloudflare/mcp (Code Mode: 2500 endpoints, 3 tools,
//   ~1.1k tokens, MCP URL https://mcp.cloudflare.com/mcp, OAuth or Bearer API token)
// - product servers: github.com/cloudflare/mcp-server-cloudflare (ai-gateway, observability,
//   bindings, builds, docs...). All remote at https://<product>.mcp.cloudflare.com/mcp,
//   Streamable HTTP (MCP spec 2026-07-28); /sse URLs are aliases, not deprecated transport.
// - wiring: developers.cloudflare.com/agents/model-context-protocol/guides/connect-mcp-client
//   (add-mcp/mcp-state onRequest pattern; onRequest only sees unclaimed paths, lifecycle
//   keeps WS + /sub/ + OAuth callbacks) + agents/docs/agents/sub-agents.md facet rules.
// Plain .js to match src/workflows/wrapper.js ".js" import pattern (no .js->.ts gamble).
// ChatRoom = facet-only child: exported from entry, NEVER in new_sqlite_classes.
// Orchestrator = parent: sole DO binding + migration, gates sub-agents via onBeforeSubAgent.
import { Agent } from "agents";
import { AIChatAgent } from "@cloudflare/ai-chat";
import { createWorkersAI } from "workers-ai-provider";
import { streamText, convertToModelMessages } from "ai";

const MODEL_ID = "@cf/moonshotai/kimi-k2.6";

// Core Cloudflare MCP servers for APIs + gateways + metrics.
// Token-authed via CLOUDFLARE_API_TOKEN secret -> no OAuth click, stable storage ids.
const CORE_MCP = [
  { id: "cf-api", name: "cloudflare-api", url: "https://mcp.cloudflare.com/mcp" },
  {
    id: "cf-ai-gateway",
    name: "cloudflare-ai-gateway",
    url: "https://ai-gateway.mcp.cloudflare.com/mcp",
  },
  {
    id: "cf-observability",
    name: "cloudflare-observability",
    url: "https://observability.mcp.cloudflare.com/mcp",
  },
  {
    id: "cf-bindings",
    name: "cloudflare-bindings",
    url: "https://bindings.mcp.cloudflare.com/mcp",
  },
];

function authHeaders(agent) {
  const token = agent.env.CLOUDFLARE_API_TOKEN;
  if (!token) return null;
  return { Authorization: `Bearer ${token}` };
}

async function ensureCoreMCP(agent) {
  const headers = authHeaders(agent);
  if (!headers) return [{ error: "CLOUDFLARE_API_TOKEN secret not set" }];
  const state = agent.getMcpServers();
  const rows = Object.values(state.servers || {});
  const out = [];
  for (const s of CORE_MCP) {
    const existing = rows.find((r) => r.server_url === s.url || r.name === s.name);
    if (existing && existing.state === "ready") {
      out.push({ name: s.name, state: "ready" });
      continue;
    }
    const res = await agent.addMcpServer(s.name, s.url, {
      id: s.id,
      transport: { type: "streamable-http", headers },
    });
    out.push({ name: s.name, state: res.state, ...(res.authUrl ? { authUrl: res.authUrl } : {}) });
  }
  return out;
}

export class ChatRoom extends AIChatAgent {
  async onChatMessage(onFinish) {
    await ensureCoreMCP(this);
    const workersAI = createWorkersAI({
      binding: this.env.AI,
      gateway: { id: this.env.CLOUDFLARE_GATEWAY_ID || "llm-gw" },
    });
    const result = streamText({
      model: workersAI(MODEL_ID, { sessionAffinity: this.sessionAffinity }),
      system:
        "You are a helpful admin dashboard assistant with live Cloudflare API, AI Gateway " +
        "and observability tools. Use them when the admin asks about infrastructure, gateways, " +
        "logs or metrics. Be concise.",
      messages: convertToModelMessages(this.messages),
      maxOutputTokens: 512,
      tools: this.mcp.getAITools(),
      onFinish,
    });
    return result.toUIMessageStreamResponse();
  }
}

export class Orchestrator extends Agent {
  // Strict-registry gate: only ChatRoom facets reachable via /sub/ routes.
  async onBeforeSubAgent(_req, { className }) {
    if (className !== "ChatRoom") {
      return new Response("forbidden sub-agent", { status: 403 });
    }
  }

  // Custom endpoints (unclaimed paths only; lifecycle keeps WS//sub//callbacks).
  // POST .../connect-core -> connect the 4 core MCP servers (idempotent).
  // GET  .../mcp-state     -> slim server+tool status (never leaks the token).
  async onRequest(request) {
    const url = new URL(request.url);
    if (url.pathname.endsWith("connect-core") && request.method === "POST") {
      return Response.json({ servers: await ensureCoreMCP(this) });
    }
    if (url.pathname.endsWith("mcp-state")) {
      const s = this.getMcpServers();
      return Response.json({
        servers: Object.values(s.servers || {}).map((r) => ({
          name: r.name,
          url: r.server_url,
          state: r.state,
          error: r.error,
        })),
        toolCount: (s.tools || []).length,
        tools: (s.tools || []).map((t) => ({ name: t.name, serverId: t.serverId })),
      });
    }
    return super.onRequest(request);
  }
}
