// SOURCE: adapted from github.com/cloudflare/templates/llm-chat-app-template/src/index.ts (MIT)
// Deltas: Astro route shape (locals.runtime.env), MODEL_ID kimi-k2.6 (llama-3.1-8b deprecated
// 2026-05-30), max_tokens 512 free-tier cap, AI Gateway enabled, D1 chat_logs tee via waitUntil.
import { validateApiTokenResponse } from "@/lib/api";

const MODEL_ID = "@cf/moonshotai/kimi-k2.6";
const SYSTEM_PROMPT =
  "You are a helpful, friendly assistant. Provide concise and accurate responses.";

export async function POST({ locals, request }) {
  const { API_TOKEN, AI, DB, CLOUDFLARE_GATEWAY_ID } = locals.runtime.env;
  const ctx = locals.runtime.ctx;

  const invalidTokenResponse = await validateApiTokenResponse(request, API_TOKEN);
  if (invalidTokenResponse) return invalidTokenResponse;

  try {
    const { messages = [], session_id } = (await request.json()) as {
      messages: { role: string; content: string }[];
      session_id?: string;
    };

    if (!messages.some((msg) => msg.role === "system")) {
      messages.unshift({ role: "system", content: SYSTEM_PROMPT });
    }
    const sessionId =
      typeof session_id === "string" && session_id.length > 0
        ? session_id.slice(0, 64)
        : crypto.randomUUID();
    const prompt = messages
      .filter((m) => m.role === "user")
      .map((m) => m.content)
      .join("\n")
      .slice(0, 4000);
    const startedAt = Date.now();

    const stream = await AI.run(
      MODEL_ID,
      { messages, max_tokens: 512, stream: true },
      {
        gateway: {
          id: CLOUDFLARE_GATEWAY_ID || "llm-gw",
          skipCache: false,
          cacheTtl: 3600,
        },
      },
    );

    // Tee the SSE stream: forward bytes untouched, accumulate completion text,
    // persist one chat_logs row after flush (waitUntil, never blocks response).
    const decoder = new TextDecoder();
    let buffer = "";
    let completion = "";
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const forward = (async () => {
      const reader = (stream as ReadableStream).getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          await writer.write(value);
          buffer += decoder.decode(value, { stream: true });
          let idx;
          while ((idx = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, idx).trim();
            buffer = buffer.slice(idx + 1);
            if (line.startsWith("data:")) {
              const payload = line.slice(5).trim();
              if (payload === "[DONE]") continue;
              try {
                const chunk = JSON.parse(payload);
                if (typeof chunk?.response === "string") completion += chunk.response;
              } catch {
                /* non-JSON heartbeat, ignore */
              }
            }
          }
        }
      } finally {
        try {
          await writer.close();
        } catch {
          /* client gone */
        }
        const latencyMs = Date.now() - startedAt;
        const tokens = Math.ceil((prompt.length + completion.length) / 4);
        ctx.waitUntil(
          (async () => {
            try {
              await DB.prepare(
                "INSERT INTO chat_logs (session_id, agent, model, prompt, completion, tokens, latency_ms) VALUES (?, ?, ?, ?, ?, ?, ?)",
              )
                .bind(
                  sessionId,
                  "simple",
                  MODEL_ID,
                  prompt,
                  completion.slice(0, 8000),
                  tokens,
                  latencyMs,
                )
                .run();
            } catch (e) {
              console.error("chat_logs insert failed:", e);
            }
          })(),
        );
      }
    })();
    void forward;

    return new Response(readable, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache",
        connection: "keep-alive",
        "x-session-id": sessionId,
      },
    });
  } catch (error) {
    console.error("Error processing chat request:", error);
    return new Response(JSON.stringify({ error: "Failed to process request" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
