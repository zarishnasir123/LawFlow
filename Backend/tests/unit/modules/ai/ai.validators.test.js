import { describe, it, expect } from "vitest";
import { makeReq, runValidators, messagesOf } from "../../../helpers/runValidators.js";
import {
  aiGuidanceValidator,
  aiPolishValidator,
  sessionUpdateValidator,
  sessionIdParamValidator,
} from "../../../../src/modules/ai/ai.validators.js";

const UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

describe("aiGuidanceValidator", () => {
  it("accepts a prompt with or without a session id", async () => {
    let result = await runValidators(aiGuidanceValidator, makeReq({ body: { prompt: "What is khula?" } }));
    expect(result.isEmpty()).toBe(true);
    result = await runValidators(
      aiGuidanceValidator,
      makeReq({ body: { prompt: "Continue…", sessionId: UUID } })
    );
    expect(result.isEmpty()).toBe(true);
  });

  it("rejects an empty or whitespace-only prompt", async () => {
    for (const bad of ["", "   "]) {
      const result = await runValidators(aiGuidanceValidator, makeReq({ body: { prompt: bad } }));
      expect(messagesOf(result)).toContain("prompt is required");
    }
  });

  it("caps the prompt at 8000 characters", async () => {
    const result = await runValidators(
      aiGuidanceValidator,
      makeReq({ body: { prompt: "x".repeat(8001) } })
    );
    expect(messagesOf(result)).toContain("prompt must be 8000 characters or less");
  });

  it("rejects a malformed session id", async () => {
    const result = await runValidators(
      aiGuidanceValidator,
      makeReq({ body: { prompt: "hi", sessionId: "chat-1" } })
    );
    expect(messagesOf(result)).toContain("sessionId must be a valid UUID");
  });
});

describe("aiPolishValidator", () => {
  it("only accepts the grammar and formal modes", async () => {
    for (const mode of ["grammar", "formal"]) {
      const result = await runValidators(aiPolishValidator, makeReq({ body: { mode, text: "Fix this." } }));
      expect(result.isEmpty(), mode).toBe(true);
    }
    const bad = await runValidators(aiPolishValidator, makeReq({ body: { mode: "casual", text: "Yo." } }));
    expect(messagesOf(bad)).toContain("mode must be 'grammar' or 'formal'");
  });

  it("rejects whitespace-only text and caps it at 4000 characters", async () => {
    let result = await runValidators(aiPolishValidator, makeReq({ body: { mode: "grammar", text: "   " } }));
    expect(messagesOf(result)).toContain("text is required");

    result = await runValidators(
      aiPolishValidator,
      makeReq({ body: { mode: "grammar", text: "x".repeat(4001) } })
    );
    expect(messagesOf(result)).toContain("text must be 4000 characters or less");
  });
});

describe("session validators", () => {
  it("requires a UUID session id in the URL", async () => {
    const result = await runValidators(sessionIdParamValidator, makeReq({ params: { sessionId: "1" } }));
    expect(messagesOf(result)).toContain("sessionId must be a valid UUID");
  });

  it("rejects an empty rename and caps titles at 120 characters", async () => {
    let result = await runValidators(
      sessionUpdateValidator,
      makeReq({ params: { sessionId: UUID }, body: { title: "   " } })
    );
    expect(messagesOf(result)).toContain("title cannot be empty");

    result = await runValidators(
      sessionUpdateValidator,
      makeReq({ params: { sessionId: UUID }, body: { title: "x".repeat(121) } })
    );
    expect(messagesOf(result)).toContain("title must be 120 characters or less");

    result = await runValidators(
      sessionUpdateValidator,
      makeReq({ params: { sessionId: UUID }, body: { title: "Property dispute research", pinned: true } })
    );
    expect(result.isEmpty()).toBe(true);
  });
});
