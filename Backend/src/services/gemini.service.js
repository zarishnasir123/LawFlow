import { ApiError } from "../utils/apiError.js";
import { postJsonWithRetry } from "./llmHttp.js";

// Reusable Google Gemini client for LawFlow. Mirrors the "is it configured?"
// pattern used by email.service.js: when the API key is missing or still a
// placeholder, callers get a clean 503 instead of a crash, so the rest of the
// app keeps working without AI configured.
//
// The API key lives ONLY here (server-side). It is never sent to the frontend
// and is never logged.

const GENERATIVE_LANGUAGE_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";

const placeholderKeys = new Set([
  "",
  "your-gemini-api-key",
  "your_gemini_api_key",
  "PUT_GEMINI_API_KEY_HERE",
  "changeme"
]);

function getApiKey() {
  return (process.env.GEMINI_API_KEY || "").trim();
}

export function getGeminiModel() {
  return (process.env.GEMINI_MODEL || "gemini-2.5-flash").trim();
}

export function isGeminiConfigured() {
  const key = getApiKey();
  return key.length > 0 && !placeholderKeys.has(key);
}

// Parses Gemini's generateContent response into plain text, turning the
// various "no usable text" outcomes (safety block, empty candidate) into
// clear ApiErrors the controller can surface.
// mode: "chat" (default) for legal Q&A, "vision" for license-card OCR.
function extractText(data, { mode = "chat" } = {}) {
  const candidate = data?.candidates?.[0];
  const parts = candidate?.content?.parts;
  const text = Array.isArray(parts)
    ? parts.map((p) => p?.text).filter(Boolean).join("")
    : "";

  if (text.trim()) return text.trim();

  const blockReason = data?.promptFeedback?.blockReason;
  const finishReason = candidate?.finishReason;

  if (blockReason || finishReason === "SAFETY" || finishReason === "RECITATION") {
    throw new ApiError(
      422,
      mode === "vision"
        ? "Could not read the license card image. Please verify the document manually."
        : "The assistant couldn't answer that request. Please rephrase your question."
    );
  }

  throw new ApiError(
    502,
    mode === "vision"
      ? "OCR returned no text from the card image. Please try again."
      : "The assistant returned an empty response. Please try again."
  );
}

// Calls Gemini's generateContent endpoint.
//
// messages: ordered conversation as [{ role: "user" | "model", text }].
// systemInstruction: the grounded persona/knowledge block (see ai.service.js).
//
// Returns the assistant's reply as a trimmed string. Throws ApiError(503) when
// the key is not configured, and maps timeouts / upstream failures to clean
// client-facing errors.
export async function generateGeminiText({
  systemInstruction,
  messages,
  temperature = 0.4,
  maxOutputTokens = 2048
}) {
  if (!isGeminiConfigured()) {
    throw new ApiError(
      503,
      "AI assistant is not configured. Add GEMINI_API_KEY to the backend .env."
    );
  }

  const model = getGeminiModel();
  const timeoutMs = Number(process.env.GEMINI_TIMEOUT_MS || 30000);

  const body = {
    contents: messages.map((m) => ({
      role: m.role,
      parts: [{ text: m.text }]
    })),
    generationConfig: {
      temperature,
      maxOutputTokens,
      // gemini-2.5 models "think" by default, which can silently eat the whole
      // output-token budget and return empty text. We don't need chain-of-thought
      // for short legal Q&A, so disable it for fast, reliable replies.
      thinkingConfig: { thinkingBudget: 0 }
    }
  };

  if (systemInstruction) {
    body.system_instruction = { parts: [{ text: systemInstruction }] };
  }

  // postJsonWithRetry handles the per-attempt timeout, transient-failure retry,
  // and maps 429/timeout/network errors to clean ApiErrors.
  const data = await postJsonWithRetry({
    url: `${GENERATIVE_LANGUAGE_BASE}/${model}:generateContent`,
    headers: { "x-goog-api-key": getApiKey() },
    body,
    timeoutMs,
    label: "gemini",
    onUpstreamError: async (res) => {
      // Read the upstream error for our own logs only — never forward Google's
      // raw payload (or our key) to the client.
      let upstreamStatus = "";
      try {
        const errBody = await res.json();
        upstreamStatus = errBody?.error?.status || "";
      } catch {
        // body wasn't JSON; ignore
      }
      console.error(`[gemini] upstream error ${res.status} ${upstreamStatus}`);
    }
  });

  return extractText(data);
}

// Vision variant: sends a single image + text prompt to Gemini and returns the
// model's text reply. Used for OCR tasks (e.g. reading a CNIC off a Bar Council
// card). Mirrors generateGeminiText but builds an inlineData part instead of a
// conversation. Defaults to temperature 0 and a short output cap since OCR
// replies are terse.
export async function generateGeminiVision({
  prompt,
  imageBase64,
  imageMimeType,
  systemInstruction,
  temperature = 0,
  maxOutputTokens = 64
}) {
  if (!isGeminiConfigured()) {
    throw new ApiError(
      503,
      "AI assistant is not configured. Add GEMINI_API_KEY to the backend .env."
    );
  }

  const model = getGeminiModel();
  const timeoutMs = Number(process.env.GEMINI_TIMEOUT_MS || 30000);

  const body = {
    contents: [{
      role: "user",
      parts: [
        { inlineData: { mimeType: imageMimeType, data: imageBase64 } },
        { text: prompt }
      ]
    }],
    generationConfig: {
      temperature,
      maxOutputTokens,
      thinkingConfig: { thinkingBudget: 0 }
    }
  };

  if (systemInstruction) {
    body.system_instruction = { parts: [{ text: systemInstruction }] };
  }

  const data = await postJsonWithRetry({
    url: `${GENERATIVE_LANGUAGE_BASE}/${model}:generateContent`,
    headers: { "x-goog-api-key": getApiKey() },
    body,
    timeoutMs,
    label: "gemini-vision",
    retryOnRateLimit: true,
    onUpstreamError: async (res) => {
      let upstreamStatus = "";
      try {
        const errBody = await res.json();
        upstreamStatus = errBody?.error?.status || "";
      } catch {
        // body wasn't JSON; ignore
      }
      console.error(`[gemini-vision] upstream error ${res.status} ${upstreamStatus}`);
    }
  });

  return extractText(data, { mode: "vision" });
}
