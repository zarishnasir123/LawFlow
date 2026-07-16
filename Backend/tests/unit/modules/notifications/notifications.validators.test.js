import { describe, it, expect } from "vitest";
import { makeReq, runValidators, messagesOf } from "../../../helpers/runValidators.js";
import {
  notificationIdParamValidator,
  updatePreferencesValidator,
} from "../../../../src/modules/notifications/notifications.validators.js";

const UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

describe("notificationIdParamValidator", () => {
  it("requires a UUID notification id", async () => {
    const bad = await runValidators(notificationIdParamValidator, makeReq({ params: { id: "n-1" } }));
    expect(messagesOf(bad)).toContain("id must be a valid UUID");

    const ok = await runValidators(notificationIdParamValidator, makeReq({ params: { id: UUID } }));
    expect(ok.isEmpty()).toBe(true);
  });
});

describe("updatePreferencesValidator", () => {
  it("accepts genuine booleans and an empty patch", async () => {
    let result = await runValidators(
      updatePreferencesValidator,
      makeReq({ body: { emailEnabled: false, payment: true } })
    );
    expect(result.isEmpty()).toBe(true);

    result = await runValidators(updatePreferencesValidator, makeReq({ body: {} }));
    expect(result.isEmpty()).toBe(true);
  });

  it('rejects the STRINGS "true"/"false" (strict booleans only)', async () => {
    // Without strict mode these would silently no-op in the service —
    // the validator is the guard against that misleading 200.
    const result = await runValidators(
      updatePreferencesValidator,
      makeReq({ body: { emailEnabled: "true" } })
    );
    expect(messagesOf(result)).toContain("emailEnabled must be true or false");
  });

  it("rejects numbers and other non-boolean values on every category", async () => {
    const result = await runValidators(
      updatePreferencesValidator,
      makeReq({ body: { case: 1, hearing: "yes", payout: 0 } })
    );
    const messages = messagesOf(result);
    expect(messages).toContain("case must be true or false");
    expect(messages).toContain("hearing must be true or false");
    expect(messages).toContain("payout must be true or false");
  });
});
