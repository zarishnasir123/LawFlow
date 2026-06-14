import { ApiError } from "../utils/apiError.js";

// Shared HTTP layer for the LLM provider clients (Groq, Gemini). Adds a
// per-attempt timeout and bounded retries on TRANSIENT failures so a momentary
// network blip or a provider 5xx recovers silently instead of surfacing an
// error to the lawyer. Definitive outcomes are not retried:
//   - 429 (rate limited)  -> ApiError(429) "busy"
//   - timeout (abort)     -> ApiError(504)
//   - other 4xx / final   -> ApiError(502)
// Retried: network errors ("fetch failed") and HTTP 5xx, with short backoff.

const RETRY_BACKOFFS_MS = [400, 1200]; // delays before attempts 2 and 3

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function postJsonWithRetry({
  url,
  headers = {},
  body,
  timeoutMs = 30000,
  label = "llm",
  onUpstreamError
}) {
  const maxAttempts = RETRY_BACKOFFS_MS.length + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      if (res.ok) {
        return await res.json();
      }

      if (onUpstreamError) {
        await onUpstreamError(res, attempt);
      }

      if (res.status === 429) {
        throw new ApiError(429, "The assistant is busy right now. Please try again in a moment.");
      }

      // Transient server-side error — retry if we still can.
      if (res.status >= 500 && attempt < maxAttempts) {
        await sleep(RETRY_BACKOFFS_MS[attempt - 1]);
        continue;
      }

      throw new ApiError(502, "Could not reach the AI assistant service.");
    } catch (err) {
      // Definitive errors bubble up unchanged.
      if (err instanceof ApiError) throw err;
      if (err?.name === "AbortError") {
        throw new ApiError(504, "The assistant took too long to respond. Please try again.");
      }

      // Network-level failure ("fetch failed"): retry with backoff if possible.
      console.error(`[${label}] request failed (attempt ${attempt}/${maxAttempts})`, err?.message);
      if (attempt < maxAttempts) {
        await sleep(RETRY_BACKOFFS_MS[attempt - 1]);
        continue;
      }
      throw new ApiError(502, "Could not reach the AI assistant service.");
    } finally {
      clearTimeout(timer);
    }
  }

  // Loop always returns or throws above; this satisfies static analysis.
  throw new ApiError(502, "Could not reach the AI assistant service.");
}
