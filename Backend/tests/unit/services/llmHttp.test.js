import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { postJsonWithRetry } from "../../../src/services/llmHttp.js";
import { ApiError } from "../../../src/utils/apiError.js";

// Plain-closure fetch stub (not vi.fn — mock-result tracking chokes on
// rejected promises). Each test loads a queue of scripted outcomes.
let fetchScript = [];
let fetchCalls = [];

function jsonResponse(status, data = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  };
}

beforeEach(() => {
  fetchScript = [];
  fetchCalls = [];
  vi.stubGlobal("fetch", (url, options) => {
    fetchCalls.push({ url, options });
    const step = fetchScript.shift();
    if (!step) throw new Error("fetch called more times than scripted");
    if (step.reject) return Promise.reject(step.reject);
    if (step.hangUntilAbort) {
      return new Promise((_, reject) => {
        options.signal.addEventListener("abort", () => {
          const err = new Error("This operation was aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    }
    return Promise.resolve(step.response);
  });
  // Retry paths log warnings/errors by design — keep test output clean.
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const networkError = () => {
  const err = new Error("fetch failed");
  return err;
};

describe("postJsonWithRetry", () => {
  it("returns the parsed JSON on a 200 with one attempt", async () => {
    fetchScript = [{ response: jsonResponse(200, { answer: "ok" }) }];
    const result = await postJsonWithRetry({ url: "https://llm.test/v1", body: { q: 1 } });
    expect(result).toEqual({ answer: "ok" });
    expect(fetchCalls).toHaveLength(1);
  });

  it("sends JSON content-type, merged headers, and a stringified body", async () => {
    fetchScript = [{ response: jsonResponse(200, {}) }];
    await postJsonWithRetry({
      url: "https://llm.test/v1",
      headers: { Authorization: "Bearer key" },
      body: { prompt: "hi" },
    });
    const { options } = fetchCalls[0];
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/json");
    expect(options.headers.Authorization).toBe("Bearer key");
    expect(options.body).toBe(JSON.stringify({ prompt: "hi" }));
  });

  it("maps 401 to a 502 ApiError without retrying (never a login-logout trigger)", async () => {
    fetchScript = [{ response: jsonResponse(401) }];
    const promise = postJsonWithRetry({ url: "https://llm.test/v1", body: {} });
    await expect(promise).rejects.toMatchObject({ statusCode: 502 });
    await expect(promise).rejects.toThrow(/API key/);
    expect(fetchCalls).toHaveLength(1);
  });

  it("maps 429 to a 429 'busy' ApiError by default (no retry)", async () => {
    fetchScript = [{ response: jsonResponse(429) }];
    const promise = postJsonWithRetry({ url: "https://llm.test/v1", body: {} });
    await expect(promise).rejects.toMatchObject({ statusCode: 429 });
    await expect(promise).rejects.toThrow(/busy/i);
    expect(fetchCalls).toHaveLength(1);
  });

  it(
    "retries a 429 once when retryOnRateLimit is set (OCR path)",
    async () => {
      fetchScript = [
        { response: jsonResponse(429) },
        { response: jsonResponse(200, { text: "cnic" }) },
      ];
      const result = await postJsonWithRetry({
        url: "https://llm.test/v1",
        body: {},
        retryOnRateLimit: true,
      });
      expect(result).toEqual({ text: "cnic" });
      expect(fetchCalls).toHaveLength(2);
    },
    10_000 // real 2s rate-limit backoff runs inside
  );

  it("retries a 500 and succeeds on the second attempt", async () => {
    fetchScript = [
      { response: jsonResponse(500) },
      { response: jsonResponse(200, { ok: true }) },
    ];
    const result = await postJsonWithRetry({ url: "https://llm.test/v1", body: {} });
    expect(result).toEqual({ ok: true });
    expect(fetchCalls).toHaveLength(2);
  });

  it(
    "gives up after three 5xx attempts with a 502",
    async () => {
      fetchScript = [
        { response: jsonResponse(500) },
        { response: jsonResponse(503) },
        { response: jsonResponse(500) },
      ];
      await expect(
        postJsonWithRetry({ url: "https://llm.test/v1", body: {} })
      ).rejects.toMatchObject({ statusCode: 502 });
      expect(fetchCalls).toHaveLength(3);
    },
    10_000 // real 400ms + 1200ms backoffs run inside
  );

  it("retries a network failure and succeeds", async () => {
    fetchScript = [
      { reject: networkError() },
      { response: jsonResponse(200, { ok: 1 }) },
    ];
    const result = await postJsonWithRetry({ url: "https://llm.test/v1", body: {} });
    expect(result).toEqual({ ok: 1 });
    expect(fetchCalls).toHaveLength(2);
  });

  it(
    "gives up after three network failures with a 502",
    async () => {
      fetchScript = [
        { reject: networkError() },
        { reject: networkError() },
        { reject: networkError() },
      ];
      await expect(
        postJsonWithRetry({ url: "https://llm.test/v1", body: {} })
      ).rejects.toMatchObject({ statusCode: 502 });
      expect(fetchCalls).toHaveLength(3);
    },
    10_000
  );

  it("maps a timeout (abort) to a 504 without retrying", async () => {
    fetchScript = [{ hangUntilAbort: true }];
    const promise = postJsonWithRetry({
      url: "https://llm.test/v1",
      body: {},
      timeoutMs: 50,
    });
    await expect(promise).rejects.toMatchObject({ statusCode: 504 });
    await expect(promise).rejects.toThrow(/too long/i);
    expect(fetchCalls).toHaveLength(1);
  });

  it("invokes onUpstreamError with the response and attempt number", async () => {
    const seen = [];
    fetchScript = [
      { response: jsonResponse(500) },
      { response: jsonResponse(200, {}) },
    ];
    await postJsonWithRetry({
      url: "https://llm.test/v1",
      body: {},
      onUpstreamError: (res, attempt) => {
        seen.push({ status: res.status, attempt });
      },
    });
    expect(seen).toEqual([{ status: 500, attempt: 1 }]);
  });

  it("throws real ApiError instances (error middleware relies on this)", async () => {
    fetchScript = [{ response: jsonResponse(429) }];
    try {
      await postJsonWithRetry({ url: "https://llm.test/v1", body: {} });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
    }
  });
});
