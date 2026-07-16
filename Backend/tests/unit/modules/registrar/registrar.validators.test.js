import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeReq, runValidators, messagesOf } from "../../../helpers/runValidators.js";

// Same live-DNS guard as the auth validator suite: only the MX lookup is
// faked; the reserved-domain logic stays real.
let mxLookupAllows = true;
vi.mock("../../../../src/utils/email.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    canEmailDomainReceiveMail: async () => mxLookupAllows,
  };
});

const {
  createRegistrarValidator,
  updateRegistrarValidator,
  setRegistrarStatusValidator,
  listRegistrarsValidator,
  registrarProfileIdParamValidator,
} = await import("../../../../src/modules/registrar/registrar.validators.js");

beforeEach(() => {
  mxLookupAllows = true;
});

const UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

const validBody = () => ({
  firstName: "Sana",
  lastName: "Iqbal",
  email: "sana.registrar@gmail.com",
  phone: "+92-300-1234567",
  cnic: "34103-1234567-1",
  assignedCourt: "District Court Gujranwala",
  assignedTehsil: "Wazirabad",
});

describe("createRegistrarValidator", () => {
  it("accepts a complete valid registrar (no password field — server generates it)", async () => {
    const result = await runValidators(createRegistrarValidator, makeReq({ body: validBody() }));
    expect(result.isEmpty()).toBe(true);
  });

  it("requires names and phone", async () => {
    const result = await runValidators(
      createRegistrarValidator,
      makeReq({ body: { email: "a@gmail.com", cnic: "34101-1234567-1" } })
    );
    const messages = messagesOf(result);
    expect(messages).toContain("First name is required");
    expect(messages).toContain("Last name is required");
    expect(messages).toContain("Phone number is required");
  });

  it("applies the same email rules as user registration", async () => {
    let result = await runValidators(
      createRegistrarValidator,
      makeReq({ body: { ...validBody(), email: "x@example.com" } })
    );
    expect(messagesOf(result)).toContain("Use a real email address, not a reserved test domain");

    mxLookupAllows = false;
    result = await runValidators(createRegistrarValidator, makeReq({ body: validBody() }));
    expect(messagesOf(result)).toContain("Email domain cannot receive mail");
  });

  it("applies the CNIC format + Gujranwala district rules", async () => {
    let result = await runValidators(
      createRegistrarValidator,
      makeReq({ body: { ...validBody(), cnic: "12345" } })
    );
    expect(messagesOf(result)).toContain("CNIC must follow Pakistan format: 12345-1234567-1");

    result = await runValidators(
      createRegistrarValidator,
      makeReq({ body: { ...validBody(), cnic: "35202-1234567-1" } })
    );
    expect(messagesOf(result).join(" ")).toMatch(/Gujranwala/);
  });

  it("rejects an unsupported assigned tehsil", async () => {
    const result = await runValidators(
      createRegistrarValidator,
      makeReq({ body: { ...validBody(), assignedTehsil: "Sialkot" } })
    );
    expect(messagesOf(result)).toContain(
      "Assigned tehsil is not supported by this LawFlow deployment"
    );
  });
});

describe("updateRegistrarValidator", () => {
  it("requires names + phone but has no email/cnic fields (identity is locked)", async () => {
    const ok = await runValidators(
      updateRegistrarValidator,
      makeReq({ body: { firstName: "Sana", lastName: "Iqbal", phone: "+92-300-1234567" } })
    );
    expect(ok.isEmpty()).toBe(true);

    const missing = await runValidators(updateRegistrarValidator, makeReq({ body: {} }));
    expect(messagesOf(missing)).toContain("First name is required");
  });
});

describe("setRegistrarStatusValidator", () => {
  it("only accepts active or inactive", async () => {
    for (const status of ["active", "inactive"]) {
      const result = await runValidators(
        setRegistrarStatusValidator,
        makeReq({ body: { accountStatus: status } })
      );
      expect(result.isEmpty(), status).toBe(true);
    }
    const bad = await runValidators(
      setRegistrarStatusValidator,
      makeReq({ body: { accountStatus: "suspended" } })
    );
    expect(messagesOf(bad)).toContain("Status must be active or inactive");
  });
});

describe("listRegistrarsValidator", () => {
  it("bounds pagination like the other list endpoints", async () => {
    const bad = await runValidators(listRegistrarsValidator, makeReq({ query: { limit: "500", offset: "-2" } }));
    const messages = messagesOf(bad);
    expect(messages).toContain("Limit must be between 1 and 100");
    expect(messages).toContain("Offset must be zero or a positive integer");
  });
});

describe("registrarProfileIdParamValidator", () => {
  it("rejects a malformed id and accepts a UUID", async () => {
    const bad = await runValidators(
      registrarProfileIdParamValidator,
      makeReq({ params: { registrarProfileId: "reg-1" } })
    );
    expect(messagesOf(bad)).toContain("Registrar id must be a valid UUID");

    const ok = await runValidators(
      registrarProfileIdParamValidator,
      makeReq({ params: { registrarProfileId: UUID } })
    );
    expect(ok.isEmpty()).toBe(true);
  });
});
