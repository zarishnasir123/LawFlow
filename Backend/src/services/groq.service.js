import { ApiError } from "../utils/apiError.js";
import { postJsonWithRetry } from "./llmHttp.js";

// Reusable Groq client for LawFlow. Mirrors gemini.service.js so the two are
// interchangeable: same generate* signature, same "is it configured?" pattern,
// same ApiError mapping. Groq exposes an OpenAI-compatible chat-completions
// endpoint and runs open models (Llama, etc.) very fast with a generous free
// tier — which is why it's the default provider for a smooth chat experience.
//
// The API key lives ONLY here (server-side). It is never sent to the frontend
// and is never logged.

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";

const placeholderKeys = new Set([
  "",
  "your-groq-api-key",
  "your_groq_api_key",
  "PUT_GROQ_API_KEY_HERE",
  "changeme"
]);

function getApiKey() {
  return (process.env.GROQ_API_KEY || "").trim();
}

export function getGroqModel() {
  return (process.env.GROQ_MODEL || "llama-3.3-70b-versatile").trim();
}

export function isGroqConfigured() {
  const key = getApiKey();
  return key.length > 0 && !placeholderKeys.has(key);
}

// Converts our neutral message shape ({ role: "user" | "model", text }) into the
// OpenAI/Groq shape ({ role: "user" | "assistant", content }), prepending the
// grounded system instruction as the first system message.
function toGroqMessages(systemInstruction, messages) {
  const out = [];
  if (systemInstruction) {
    out.push({ role: "system", content: systemInstruction });
  }
  for (const m of messages) {
    out.push({
      role: m.role === "model" ? "assistant" : "user",
      content: m.text
    });
  }
  return out;
}

// Calls Groq's chat-completions endpoint. Same contract as generateGeminiText:
// messages is [{ role: "user" | "model", text }]; returns the reply as trimmed
// text; throws ApiError(503) when the key is missing and maps timeouts /
// upstream failures to clean client-facing errors.
export async function generateGroqText({
  systemInstruction,
  messages,
  temperature = 0.4,
  maxOutputTokens = 2048
}) {
  if (!isGroqConfigured()) {
    throw new ApiError(
      503,
      "AI assistant is not configured. Add GROQ_API_KEY to the backend .env."
    );
  }

  const model = getGroqModel();
  const timeoutMs = Number(process.env.AI_TIMEOUT_MS || process.env.GROQ_TIMEOUT_MS || 30000);

  const body = {
    model,
    messages: toGroqMessages(systemInstruction, messages),
    temperature,
    max_tokens: maxOutputTokens
  };

  // postJsonWithRetry handles the per-attempt timeout, transient-failure retry,
  // and maps 429/timeout/network errors to clean ApiErrors.
  const data = await postJsonWithRetry({
    url: GROQ_CHAT_URL,
    headers: { Authorization: `Bearer ${getApiKey()}` },
    body,
    timeoutMs,
    label: "groq",
    onUpstreamError: async (res) => {
      // Log the upstream error for our own diagnostics only — never forward
      // Groq's raw payload (or our key) to the client.
      let upstreamType = "";
      try {
        const errBody = await res.json();
        upstreamType = errBody?.error?.type || errBody?.error?.code || "";
      } catch {
        // body wasn't JSON; ignore
      }
      console.error(`[groq] upstream error ${res.status} ${upstreamType}`);
    }
  });

  const text = data?.choices?.[0]?.message?.content;
  if (typeof text === "string" && text.trim()) {
    return text.trim();
  }

  throw new ApiError(502, "The assistant returned an empty response. Please try again.");
}
