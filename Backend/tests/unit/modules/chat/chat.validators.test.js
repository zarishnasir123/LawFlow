import { describe, it, expect } from "vitest";
import { makeReq, runValidators, messagesOf } from "../../../helpers/runValidators.js";
import {
  conversationIdParamValidator,
  startConversationValidator,
  sendMessageValidator,
} from "../../../../src/modules/chat/chat.validators.js";

const UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

describe("startConversationValidator", () => {
  it("requires the lawyer's user id to be a UUID", async () => {
    const bad = await runValidators(startConversationValidator, makeReq({ body: { lawyerUserId: "l-1" } }));
    expect(messagesOf(bad)).toContain("lawyerUserId must be a valid UUID");

    const ok = await runValidators(startConversationValidator, makeReq({ body: { lawyerUserId: UUID } }));
    expect(ok.isEmpty()).toBe(true);
  });
});

describe("sendMessageValidator", () => {
  const valid = () => ({ params: { conversationId: UUID }, body: { text: "Salaam, any update on my case?" } });

  it("accepts a normal message (with an optional reply reference)", async () => {
    expect((await runValidators(sendMessageValidator, makeReq(valid()))).isEmpty()).toBe(true);

    const withReply = makeReq(valid());
    withReply.body.replyToMessageId = UUID;
    expect((await runValidators(sendMessageValidator, withReply)).isEmpty()).toBe(true);
  });

  it("rejects empty or whitespace-only messages", async () => {
    for (const bad of ["", "   "]) {
      const req = makeReq(valid());
      req.body.text = bad;
      expect(messagesOf(await runValidators(sendMessageValidator, req))).toContain(
        "Message text is required"
      );
    }
  });

  it("caps a message at 5000 characters", async () => {
    const req = makeReq(valid());
    req.body.text = "x".repeat(5001);
    expect(messagesOf(await runValidators(sendMessageValidator, req))).toContain(
      "Message is too long (5000 characters max)"
    );
  });

  it("rejects a malformed reply reference or conversation id", async () => {
    let req = makeReq(valid());
    req.body.replyToMessageId = "msg-9";
    expect(messagesOf(await runValidators(sendMessageValidator, req))).toContain(
      "replyToMessageId must be a valid UUID"
    );

    const badConvo = await runValidators(
      conversationIdParamValidator,
      makeReq({ params: { conversationId: "42" } })
    );
    expect(messagesOf(badConvo)).toContain("conversationId must be a valid UUID");
  });
});
