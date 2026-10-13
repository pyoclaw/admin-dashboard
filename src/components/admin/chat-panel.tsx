// SOURCE: UI pattern from llm-chat-app-template/public/index.html (vanilla SSE read)
// + agents-starter useAgentChat. Simple tab = fetch SSE. Agent tab = durable ChatRoom facet.
import { useState, useRef, useEffect } from "react";
import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";

function parseSSEChunk(text: string): string {
  let out = "";
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("data:")) continue;
    const payload = t.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const chunk = JSON.parse(payload);
      if (typeof chunk?.response === "string") out += chunk.response;
    } catch {
      /* heartbeat */
    }
  }
  return out;
}

function SimpleChat({ apiToken }: { apiToken: string }) {
  const [log, setLog] = useState<{ role: string; text: string }[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const sessionRef = useRef<string>(
    (typeof localStorage !== "undefined" && localStorage.getItem("chat-session")) ||
      crypto.randomUUID(),
  );
  useEffect(() => {
    localStorage.setItem("chat-session", sessionRef.current);
  }, []);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);
    setLog((l) => [...l, { role: "user", text }]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-token": apiToken },
        body: JSON.stringify({
          messages: [{ role: "user", content: text }],
          session_id: sessionRef.current,
        }),
      });
      if (!res.ok || !res.body) throw new Error(`chat ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      setLog((l) => [...l, { role: "assistant", text: "" }]);
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += parseSSEChunk(decoder.decode(value, { stream: true }));
        const snapshot = acc;
        setLog((l) => {
          const next = [...l];
          next[next.length - 1] = { role: "assistant", text: snapshot };
          return next;
        });
      }
    } catch (e) {
      setLog((l) => [...l, { role: "assistant", text: `error: ${(e as Error).message}` }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border p-4 h-96 overflow-y-auto space-y-2 bg-card">
        {log.length === 0 && <p className="text-muted-foreground text-sm">no messages yet</p>}
        {log.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <span
              className={
                "inline-block rounded-lg px-3 py-2 text-sm " +
                (m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted")
              }
            >
              {m.text}
            </span>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-lg border px-3 py-2 text-sm bg-background"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="ask…"
          disabled={busy}
        />
        <button
          className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          onClick={send}
          disabled={busy}
        >
          send
        </button>
      </div>
    </div>
  );
}

function AgentChat() {
  const agent = useAgent({
    agent: "Orchestrator",
    name: "admin",
    sub: [{ agent: "ChatRoom", name: "main" }],
  });
  const { messages, sendMessage, status } = useAgentChat({ agent });
  const [input, setInput] = useState("");
  const [mcp, setMcp] = useState<{ servers: any[]; toolCount: number } | null>(null);

  async function refreshMcp() {
    try {
      const res = await fetch("/agents/orchestrator/admin/mcp-state");
      if (res.ok) setMcp(await res.json());
    } catch {
      /* agent unreachable until first deploy */
    }
  }
  useEffect(() => {
    refreshMcp();
  }, []);

  async function connect() {
    await fetch("/agents/orchestrator/admin/connect-core", { method: "POST" });
    await refreshMcp();
  }

  async function send() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    await sendMessage({ text });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">durable facet room main · {status}</p>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>
          cloudflare mcp:{" "}
          {mcp
            ? `${mcp.servers.map((s) => `${s.name}=${s.state}`).join(", ")} · ${mcp.toolCount} tools`
            : "unknown"}
        </span>
        <button className="rounded border px-2 py-0.5" onClick={connect}>
          connect
        </button>
      </div>
      <div className="rounded-xl border p-4 h-96 overflow-y-auto space-y-2 bg-card">
        {messages.map((m: any, i: number) => (
          <div key={m.id ?? i} className="text-sm">
            <span className="text-muted-foreground">{m.role}: </span>
            {m.parts
              ?.filter((p: any) => p.type === "text")
              .map((p: any, j: number) => <span key={j}>{p.text}</span>)}
            {(m.parts?.some((p: any) => p.type !== "text") ?? false) && (
              <span className="text-muted-foreground"> [tool call]</span>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-lg border px-3 py-2 text-sm bg-background"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="ask the agent…"
        />
        <button
          className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground"
          onClick={send}
        >
          send
        </button>
      </div>
    </div>
  );
}

export function ChatPanel({ apiToken }: { apiToken: string }) {
  const [tab, setTab] = useState<"simple" | "agent">("simple");
  if (!apiToken) return <p className="text-sm text-muted-foreground">set API_TOKEN first</p>;
  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex gap-2">
        {(["simple", "agent"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              "rounded-lg border px-4 py-1.5 text-sm " +
              (tab === t ? "bg-primary text-primary-foreground" : "bg-card")
            }
          >
            {t === "simple" ? "simple (Workers AI SSE)" : "agent (durable facet)"}
          </button>
        ))}
      </div>
      {tab === "simple" ? <SimpleChat apiToken={apiToken} /> : <AgentChat />}
    </div>
  );
}
