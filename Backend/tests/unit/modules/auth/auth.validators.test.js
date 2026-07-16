import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeReq, runValidators, messagesOf } from "../../../helpers/runValidators.js";

// The registration email rule performs a LIVE DNS MX lookup — mock only that
// function (reserved-domain logic stays real). Plain closure by design.
let mxLookupAllows = true;
vi.mock("../../../../src/utils/email.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    canEmailDomainReceiveMail: async () => mxLookupAllows,
  };
});

const {
  registerClientValidator,
  registerLawyerValidator,
  updateMyProfileValidator,
  loginValidator,
  verifyEmailValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  changePasswordValidator,
  reviewLawyerValidator,
  suspendLawyerValidator,
  listPendingLawyersValidator,
  listLawyerRejectionHistoryValidator,
  verifyCnicValidator,
} = await import("../../../../src/modules/auth/auth.validators.js");

beforeEach(() => {
  mxLookupAllows = true;
});

const validClientBody = () => ({
  firstName: "Zarish",
  lastName: "Nasir",
  email: "zarish@gmail.com",
  phone: "+92-300-1234567",
  cnic: "34101-1234567-1",
  password: "Passw0rd!",
  confirmPassword: "Passw0rd!",
});

const lawyerFiles = () => ({
  degreeDocument: [{ mimetype: "application/pdf", originalname: "degree.pdf" }],
  licenseCardFrontImage: [{ mimetype: "image/png", originalname: "front.png" }],
  licenseCardBackImage: [{ mimetype: "image/jpeg", originalname: "back.jpg" }],
});

describe("registerClientValidator", () => {
  it("accepts a complete valid registration", async () => {
    const result = await runValidators(registerClientValidator, makeReq({ body: validClientBody() }));
    expect(result.isEmpty()).toBe(true);
  });

  it("requires first and last name (accepting snake_case too)", async () => {
    const body = validClientBody();
    delete body.firstName;
    let result = await runValidators(registerClientValidator, makeReq({ body }));
    expect(messagesOf(result)).toContain("First name is required");

    const snake = { ...validClientBody(), firstName: undefined, first_name: "Zarish" };
    result = await runValidators(registerClientValidator, makeReq({ body: snake }));
    expect(result.isEmpty()).toBe(true);
  });

  it("caps name length at 100 characters", async () => {
    const body = { ...validClientBody(), firstName: "z".repeat(101) };
    const result = await runValidators(registerClientValidator, makeReq({ body }));
    expect(messagesOf(result)).toContain("First name must be 100 characters or less");
  });

  it("rejects an invalid email and lowercases a valid one", async () => {
    let result = await runValidators(
      registerClientValidator,
      makeReq({ body: { ...validClientBody(), email: "not-an-email" } })
    );
    expect(messagesOf(result)).toContain("Valid email is required");

    const req = makeReq({ body: { ...validClientBody(), email: "Zarish@GMAIL.com" } });
    result = await runValidators(registerClientValidator, req);
    expect(result.isEmpty()).toBe(true);
    expect(req.body.email).toBe("zarish@gmail.com");
  });

  it("rejects reserved test domains", async () => {
    const result = await runValidators(
      registerClientValidator,
      makeReq({ body: { ...validClientBody(), email: "a@example.com" } })
    );
    expect(messagesOf(result)).toContain("Use a real email address, not a reserved test domain");
  });

  it("rejects a domain that cannot receive mail (mocked MX lookup)", async () => {
    mxLookupAllows = false;
    const result = await runValidators(registerClientValidator, makeReq({ body: validClientBody() }));
    expect(messagesOf(result)).toContain("Email domain cannot receive mail");
  });

  it("requires the phone number", async () => {
    const body = validClientBody();
    delete body.phone;
    const result = await runValidators(registerClientValidator, makeReq({ body }));
    expect(messagesOf(result)).toContain("Phone number is required");
  });

  it("rejects a badly formatted CNIC", async () => {
    const result = await runValidators(
      registerClientValidator,
      makeReq({ body: { ...validClientBody(), cnic: "3410112345671" } })
    );
    expect(messagesOf(result)).toContain("CNIC must follow Pakistan format: 12345-1234567-1");
  });

  it("rejects a CNIC from outside Gujranwala", async () => {
    const result = await runValidators(
      registerClientValidator,
      makeReq({ body: { ...validClientBody(), cnic: "35202-1234567-1" } })
    );
    expect(messagesOf(result).join(" ")).toMatch(/Gujranwala/);
  });

  it("enforces the password rule at its boundaries", async () => {
    // 8 chars with digit + special: passes.
    let result = await runValidators(
      registerClientValidator,
      makeReq({ body: { ...validClientBody(), password: "abcde1!x", confirmPassword: "abcde1!x" } })
    );
    expect(result.isEmpty()).toBe(true);

    // 7 chars: fails. No digit: fails. No special: fails.
    for (const bad of ["abcd1!x", "abcdefg!", "abcdefg1"]) {
      result = await runValidators(
        registerClientValidator,
        makeReq({ body: { ...validClientBody(), password: bad, confirmPassword: bad } })
      );
      expect(result.isEmpty(), `"${bad}" should be rejected`).toBe(false);
    }
  });

  it("rejects a mismatched password confirmation", async () => {
    const result = await runValidators(
      registerClientValidator,
      makeReq({ body: { ...validClientBody(), confirmPassword: "Different1!" } })
    );
    expect(messagesOf(result)).toContain("Password and confirm password do not match");
  });

  it("accepts supported tehsils and rejects unsupported ones", async () => {
    let result = await runValidators(
      registerClientValidator,
      makeReq({ body: { ...validClientBody(), tehsil: "Kamoke" } })
    );
    expect(result.isEmpty()).toBe(true);

    result = await runValidators(
      registerClientValidator,
      makeReq({ body: { ...validClientBody(), tehsil: "Lahore" } })
    );
    expect(messagesOf(result)).toContain("Tehsil is not supported by this LawFlow deployment");
  });
});

describe("registerLawyerValidator", () => {
  const validLawyerBody = () => ({
    ...validClientBody(),
    specialization: "Civil",
    districtBar: "Gujranwala Bar Association",
    barLicenseNumber: "GBA-12345",
  });

  it("accepts a complete valid lawyer registration with all three documents", async () => {
    const result = await runValidators(
      registerLawyerValidator,
      makeReq({ body: validLawyerBody(), files: lawyerFiles() })
    );
    expect(result.isEmpty()).toBe(true);
  });

  it("only allows Civil or Family as specialization", async () => {
    const result = await runValidators(
      registerLawyerValidator,
      makeReq({ body: { ...validLawyerBody(), specialization: "Criminal" }, files: lawyerFiles() })
    );
    expect(messagesOf(result)).toContain("Specialization must be Civil or Family");
  });

  it("requires the bar license number", async () => {
    const body = validLawyerBody();
    delete body.barLicenseNumber;
    const result = await runValidators(
      registerLawyerValidator,
      makeReq({ body, files: lawyerFiles() })
    );
    expect(messagesOf(result)).toContain("Bar license number is required");
  });

  it("bounds experience years to 0-80", async () => {
    for (const bad of ["-1", "81"]) {
      const result = await runValidators(
        registerLawyerValidator,
        makeReq({ body: { ...validLawyerBody(), experienceYears: bad }, files: lawyerFiles() })
      );
      expect(messagesOf(result)).toContain("Experience years must be a valid number");
    }
  });

  it("requires the law degree PDF", async () => {
    const files = lawyerFiles();
    delete files.degreeDocument;
    const result = await runValidators(
      registerLawyerValidator,
      makeReq({ body: validLawyerBody(), files })
    );
    expect(messagesOf(result)).toContain("Law degree document is required");
  });

  it("rejects a non-PDF degree document", async () => {
    const files = lawyerFiles();
    files.degreeDocument = [{ mimetype: "image/png", originalname: "degree.png" }];
    const result = await runValidators(
      registerLawyerValidator,
      makeReq({ body: validLawyerBody(), files })
    );
    expect(messagesOf(result)).toContain("Law degree document must be PDF");
  });

  it("rejects a non-image license card picture", async () => {
    const files = lawyerFiles();
    files.licenseCardFrontImage = [{ mimetype: "application/pdf", originalname: "front.pdf" }];
    const result = await runValidators(
      registerLawyerValidator,
      makeReq({ body: validLawyerBody(), files })
    );
    expect(messagesOf(result)).toContain("Bar license card front picture must be JPEG or PNG");
  });
});

describe("updateMyProfileValidator (PATCH /auth/me)", () => {
  it("accepts an empty patch (all fields optional)", async () => {
    const result = await runValidators(updateMyProfileValidator, makeReq({ body: {} }));
    expect(result.isEmpty()).toBe(true);
  });

  it("still validates a CNIC when one is sent", async () => {
    let result = await runValidators(
      updateMyProfileValidator,
      makeReq({ body: { cnic: "not-a-cnic" } })
    );
    expect(result.isEmpty()).toBe(false);

    result = await runValidators(
      updateMyProfileValidator,
      makeReq({ body: { cnic: "34101-1234567-1" } })
    );
    expect(result.isEmpty()).toBe(true);
  });

  it("does NOT enforce the supported-tehsil list on PATCH (registration-only rule)", async () => {
    const result = await runValidators(
      updateMyProfileValidator,
      makeReq({ body: { tehsil: "Lahore" } })
    );
    expect(result.isEmpty()).toBe(true);
  });

  it("bounds lawyer fields: specialization set, experience 0-80, bio 120 chars", async () => {
    let result = await runValidators(
      updateMyProfileValidator,
      makeReq({ body: { specialization: "Criminal" } })
    );
    expect(messagesOf(result)).toContain("Specialization must be Civil or Family");

    result = await runValidators(
      updateMyProfileValidator,
      makeReq({ body: { experienceYears: "99" } })
    );
    expect(messagesOf(result)).toContain("Experience years must be a valid number");

    result = await runValidators(
      updateMyProfileValidator,
      makeReq({ body: { bio: "x".repeat(121) } })
    );
    expect(messagesOf(result)).toContain("About must be 120 characters or less");

    result = await runValidators(
      updateMyProfileValidator,
      makeReq({ body: { specialization: "family", experienceYears: "10", bio: "x".repeat(120) } })
    );
    expect(result.isEmpty()).toBe(true);
  });
});

describe("loginValidator", () => {
  it("accepts a normal login body", async () => {
    const result = await runValidators(
      loginValidator,
      makeReq({ body: { email: "a@b.com", password: "secret", rememberMe: "true", expectedRole: "client" } })
    );
    expect(result.isEmpty()).toBe(true);
  });

  it("requires email and password", async () => {
    const result = await runValidators(loginValidator, makeReq({ body: {} }));
    const messages = messagesOf(result);
    expect(messages).toContain("Valid email is required");
    expect(messages).toContain("Password is required");
  });

  it("rejects an unknown expectedRole", async () => {
    const result = await runValidators(
      loginValidator,
      makeReq({ body: { email: "a@b.com", password: "x", expectedRole: "superadmin" } })
    );
    expect(messagesOf(result)).toContain("Invalid expected role");
  });

  it("rejects a non-boolean rememberMe", async () => {
    const result = await runValidators(
      loginValidator,
      makeReq({ body: { email: "a@b.com", password: "x", rememberMe: "definitely" } })
    );
    expect(messagesOf(result)).toContain("Remember me must be true or false");
  });
});

describe("verifyEmailValidator", () => {
  it("accepts a valid email + 6-digit OTP", async () => {
    const result = await runValidators(
      verifyEmailValidator,
      makeReq({ body: { email: "a@b.com", otp: "123456" } })
    );
    expect(result.isEmpty()).toBe(true);
  });

  it("rejects OTPs that are not exactly 6 digits", async () => {
    for (const bad of ["12345", "1234567", "abcdef", ""]) {
      const result = await runValidators(
        verifyEmailValidator,
        makeReq({ body: { email: "a@b.com", otp: bad } })
      );
      expect(messagesOf(result), `"${bad}"`).toContain("OTP must be a 6-digit code");
    }
  });
});

describe("forgotPasswordValidator", () => {
  it("requires a valid email", async () => {
    const bad = await runValidators(forgotPasswordValidator, makeReq({ body: { email: "nope" } }));
    expect(messagesOf(bad)).toContain("Valid email is required");
    const ok = await runValidators(forgotPasswordValidator, makeReq({ body: { email: "a@b.com" } }));
    expect(ok.isEmpty()).toBe(true);
  });
});

describe("resetPasswordValidator", () => {
  const hexToken = "a".repeat(64);

  it("accepts a 64-char hex token with a strong password", async () => {
    const result = await runValidators(
      resetPasswordValidator,
      makeReq({ body: { token: hexToken, password: "Passw0rd!", confirmPassword: "Passw0rd!" } })
    );
    expect(result.isEmpty()).toBe(true);
  });

  it("rejects missing, non-hex, and wrong-length tokens", async () => {
    let result = await runValidators(
      resetPasswordValidator,
      makeReq({ body: { password: "Passw0rd!", confirmPassword: "Passw0rd!" } })
    );
    expect(messagesOf(result)).toContain("Reset token is required");

    result = await runValidators(
      resetPasswordValidator,
      makeReq({ body: { token: "z".repeat(64), password: "Passw0rd!", confirmPassword: "Passw0rd!" } })
    );
    expect(messagesOf(result)).toContain("Invalid token format");

    result = await runValidators(
      resetPasswordValidator,
      makeReq({ body: { token: "a".repeat(63), password: "Passw0rd!", confirmPassword: "Passw0rd!" } })
    );
    expect(messagesOf(result)).toContain("Invalid token length");
  });

  it("rejects a weak password or mismatched confirmation", async () => {
    let result = await runValidators(
      resetPasswordValidator,
      makeReq({ body: { token: hexToken, password: "weak", confirmPassword: "weak" } })
    );
    expect(result.isEmpty()).toBe(false);

    result = await runValidators(
      resetPasswordValidator,
      makeReq({ body: { token: hexToken, password: "Passw0rd!", confirmPassword: "Other1!x" } })
    );
    expect(messagesOf(result)).toContain("Password and confirm password do not match");
  });
});

describe("changePasswordValidator", () => {
  it("requires the current password and a strong new password", async () => {
    const result = await runValidators(changePasswordValidator, makeReq({ body: { newPassword: "weak" } }));
    const messages = messagesOf(result);
    expect(messages).toContain("Current password is required");
    expect(messages.join(" ")).toMatch(/at least 8 characters/);
  });

  it("rejects a mismatched confirmation but tolerates an absent one", async () => {
    let result = await runValidators(
      changePasswordValidator,
      makeReq({ body: { currentPassword: "old", newPassword: "Passw0rd!", confirmNewPassword: "Nope1!xx" } })
    );
    expect(messagesOf(result)).toContain("New password and confirm password do not match");

    // Documented actual behavior: confirmation is optional at the validator
    // level — omitted entirely means no mismatch check runs.
    result = await runValidators(
      changePasswordValidator,
      makeReq({ body: { currentPassword: "old", newPassword: "Passw0rd!" } })
    );
    expect(result.isEmpty()).toBe(true);
  });
});

describe("reviewLawyerValidator", () => {
  it("approves without remarks", async () => {
    const result = await runValidators(reviewLawyerValidator, makeReq({ body: { status: "approved" } }));
    expect(result.isEmpty()).toBe(true);
  });

  it("requires remarks when rejecting", async () => {
    const result = await runValidators(reviewLawyerValidator, makeReq({ body: { status: "rejected" } }));
    expect(messagesOf(result)).toContain("Remarks are required when rejecting a lawyer registration");
  });

  it("accepts a rejection that has remarks", async () => {
    const result = await runValidators(
      reviewLawyerValidator,
      makeReq({ body: { status: "rejected", remarks: "License number does not match the bar records." } })
    );
    expect(result.isEmpty()).toBe(true);
  });

  it("only allows approved or rejected as status", async () => {
    const result = await runValidators(reviewLawyerValidator, makeReq({ body: { status: "banned" } }));
    expect(messagesOf(result)).toContain("Status must be approved or rejected");
  });

  it("caps remarks at 1000 characters", async () => {
    const result = await runValidators(
      reviewLawyerValidator,
      makeReq({ body: { status: "rejected", remarks: "x".repeat(1001) } })
    );
    expect(messagesOf(result)).toContain("Remarks must be 1000 characters or less");
  });
});

describe("suspendLawyerValidator", () => {
  it("requires a reason within 1000 characters", async () => {
    let result = await runValidators(suspendLawyerValidator, makeReq({ body: {} }));
    expect(messagesOf(result)).toContain("Suspension reason is required");

    result = await runValidators(
      suspendLawyerValidator,
      makeReq({ body: { reason: "x".repeat(1001) } })
    );
    expect(messagesOf(result)).toContain("Suspension reason must be 1000 characters or less");

    result = await runValidators(
      suspendLawyerValidator,
      makeReq({ body: { reason: "Repeated misconduct reports." } })
    );
    expect(result.isEmpty()).toBe(true);
  });
});

describe("list validators (pagination + search)", () => {
  it("bounds limit to 1-100 and offset to >= 0", async () => {
    let result = await runValidators(listPendingLawyersValidator, makeReq({ query: { limit: "0" } }));
    expect(messagesOf(result)).toContain("Limit must be between 1 and 100");

    result = await runValidators(listPendingLawyersValidator, makeReq({ query: { limit: "101" } }));
    expect(messagesOf(result)).toContain("Limit must be between 1 and 100");

    result = await runValidators(listPendingLawyersValidator, makeReq({ query: { offset: "-1" } }));
    expect(messagesOf(result)).toContain("Offset must be zero or a positive integer");

    const req = makeReq({ query: { limit: "50", offset: "0" } });
    result = await runValidators(listPendingLawyersValidator, req);
    expect(result.isEmpty()).toBe(true);
    expect(req.query.limit).toBe(50); // sanitized to a number
  });

  it("caps rejection-history search at 120 characters", async () => {
    const result = await runValidators(
      listLawyerRejectionHistoryValidator,
      makeReq({ query: { search: "x".repeat(121) } })
    );
    expect(messagesOf(result)).toContain("Search must be 120 characters or less");
  });
});

describe("verifyCnicValidator", () => {
  it("requires a UUID lawyer profile id in the URL", async () => {
    let result = await runValidators(verifyCnicValidator, makeReq({ params: { lawyerProfileId: "123" } }));
    expect(messagesOf(result)).toContain("Invalid lawyer profile ID format");

    result = await runValidators(
      verifyCnicValidator,
      makeReq({ params: { lawyerProfileId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301" } })
    );
    expect(result.isEmpty()).toBe(true);
  });
});
