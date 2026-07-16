import { describe, it, expect } from "vitest";
import { makeReq, runValidators, messagesOf } from "../../../helpers/runValidators.js";
import {
  getProposedHearingSlotValidator,
  confirmHearingValidator,
  recordOutcomeValidator,
  rescheduleHearingValidator,
  cancelHearingValidator,
  listCaseHearingsValidator,
  listRegistrarHearingsValidator,
  addHolidayValidator,
  deleteHolidayValidator,
} from "../../../../src/modules/hearings/hearings.validators.js";

const UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const SLOTS = ["09:00", "10:00", "11:00", "12:00", "14:00", "15:00"];

describe("confirmHearingValidator", () => {
  const valid = () => ({
    params: { caseId: UUID },
    body: { date: "2026-08-03", startTime: "09:00", courtroomId: UUID, hearingType: "First Appearance / Summons" },
  });

  it("accepts a valid confirmation", async () => {
    const result = await runValidators(confirmHearingValidator, makeReq(valid()));
    expect(result.isEmpty()).toBe(true);
  });

  it("accepts every permitted time slot", async () => {
    for (const slot of SLOTS) {
      const req = makeReq(valid());
      req.body.startTime = slot;
      const result = await runValidators(confirmHearingValidator, req);
      expect(result.isEmpty(), slot).toBe(true);
    }
  });

  it("rejects times outside the permitted slots (e.g. the lunch hour)", async () => {
    for (const bad of ["13:00", "09:30", "16:00", ""]) {
      const req = makeReq(valid());
      req.body.startTime = bad;
      const result = await runValidators(confirmHearingValidator, req);
      expect(messagesOf(result).join(" "), bad).toMatch(/Invalid time slot/);
    }
  });

  it("rejects a malformed date, case id, or courtroom id and a missing type", async () => {
    let req = makeReq(valid());
    req.body.date = "3rd of August";
    expect(messagesOf(await runValidators(confirmHearingValidator, req))).toContain(
      "Date must be a valid ISO 8601 date (YYYY-MM-DD)."
    );

    req = makeReq(valid());
    req.params.caseId = "123";
    expect(messagesOf(await runValidators(confirmHearingValidator, req))).toContain(
      "Invalid case ID format."
    );

    req = makeReq(valid());
    req.body.courtroomId = "room-1";
    expect(messagesOf(await runValidators(confirmHearingValidator, req))).toContain(
      "Invalid courtroom ID format."
    );

    req = makeReq(valid());
    req.body.hearingType = "  ";
    expect(messagesOf(await runValidators(confirmHearingValidator, req))).toContain(
      "Hearing type is required."
    );
  });
});

describe("recordOutcomeValidator", () => {
  it("accepts each legal outcome", async () => {
    for (const outcome of ["completed", "adjourned", "disposed"]) {
      const result = await runValidators(
        recordOutcomeValidator,
        makeReq({ params: { hearingId: UUID }, body: { outcome } })
      );
      expect(result.isEmpty(), outcome).toBe(true);
    }
  });

  it("rejects an unknown outcome", async () => {
    const result = await runValidators(
      recordOutcomeValidator,
      makeReq({ params: { hearingId: UUID }, body: { outcome: "dismissed" } })
    );
    expect(messagesOf(result)).toContain("Outcome must be completed, adjourned, or disposed.");
  });
});

describe("rescheduleHearingValidator", () => {
  it("accepts a valid reschedule and rejects a bad new slot", async () => {
    const valid = makeReq({
      params: { hearingId: UUID },
      body: { newDate: "2026-08-10", newStartTime: "14:00", newCourtroomId: UUID },
    });
    expect((await runValidators(rescheduleHearingValidator, valid)).isEmpty()).toBe(true);

    const bad = makeReq({
      params: { hearingId: UUID },
      body: { newDate: "2026-08-10", newStartTime: "17:00", newCourtroomId: UUID },
    });
    expect(messagesOf(await runValidators(rescheduleHearingValidator, bad)).join(" ")).toMatch(
      /Invalid time slot/
    );
  });
});

describe("listRegistrarHearingsValidator", () => {
  it("accepts known status filters and no filter at all", async () => {
    for (const status of ["proposed", "scheduled", "completed", "adjourned", "cancelled"]) {
      const result = await runValidators(listRegistrarHearingsValidator, makeReq({ query: { status } }));
      expect(result.isEmpty(), status).toBe(true);
    }
    expect((await runValidators(listRegistrarHearingsValidator, makeReq())).isEmpty()).toBe(true);
  });

  it("rejects an unknown status filter", async () => {
    const result = await runValidators(
      listRegistrarHearingsValidator,
      makeReq({ query: { status: "archived" } })
    );
    expect(messagesOf(result)).toContain("Invalid status filter.");
  });
});

describe("addHolidayValidator", () => {
  it("requires a valid date and a reason", async () => {
    const ok = await runValidators(
      addHolidayValidator,
      makeReq({ body: { date: "2026-08-14", reason: "Independence Day" } })
    );
    expect(ok.isEmpty()).toBe(true);

    const badDate = await runValidators(
      addHolidayValidator,
      makeReq({ body: { date: "14 August", reason: "Independence Day" } })
    );
    expect(messagesOf(badDate)).toContain("Date must be a valid ISO 8601 date (YYYY-MM-DD).");

    const noReason = await runValidators(addHolidayValidator, makeReq({ body: { date: "2026-08-14", reason: " " } }));
    expect(messagesOf(noReason)).toContain("Reason is required.");
  });
});

describe("UUID-only param validators", () => {
  it("each rejects a malformed id and accepts a real UUID", async () => {
    const table = [
      [getProposedHearingSlotValidator, "caseId"],
      [cancelHearingValidator, "hearingId"],
      [listCaseHearingsValidator, "caseId"],
      [deleteHolidayValidator, "id"],
    ];
    for (const [chain, paramName] of table) {
      const bad = await runValidators(chain, makeReq({ params: { [paramName]: "42" } }));
      expect(bad.isEmpty(), `${paramName} bad id`).toBe(false);
      const ok = await runValidators(chain, makeReq({ params: { [paramName]: UUID } }));
      expect(ok.isEmpty(), `${paramName} good id`).toBe(true);
    }
  });
});
