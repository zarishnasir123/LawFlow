import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the DNS module so no test ever performs a live MX lookup.
// Deliberately a plain closure (not vi.fn): Vitest's mock-result tracking
// chokes on rejected / never-settling promises, which this suite needs.
let resolveMxImpl = () => Promise.resolve([]);
const resolveMxCalls = [];

vi.mock("dns/promises", () => ({
  Resolver: class {
    resolveMx(domain) {
      resolveMxCalls.push(domain);
      return resolveMxImpl(domain);
    }
    cancel() {}
  },
}));

const { getEmailDomain, isReservedEmailDomain, canEmailDomainReceiveMail } =
  await import("../../../src/utils/email.js");

beforeEach(() => {
  resolveMxImpl = () => Promise.resolve([]);
  resolveMxCalls.length = 0;
});

describe("getEmailDomain", () => {
  it("extracts and lowercases the domain", () => {
    expect(getEmailDomain("Zarish@Gmail.COM")).toBe("gmail.com");
  });

  it("trims whitespace around the domain", () => {
    expect(getEmailDomain("user@gmail.com ")).toBe("gmail.com");
  });

  it("returns an empty string when there is no @ or no input", () => {
    expect(getEmailDomain("not-an-email")).toBe("");
    expect(getEmailDomain("")).toBe("");
    expect(getEmailDomain(null)).toBe("");
    expect(getEmailDomain(undefined)).toBe("");
  });
});

describe("isReservedEmailDomain", () => {
  it("flags the reserved test domains", () => {
    expect(isReservedEmailDomain("a@example.com")).toBe(true);
    expect(isReservedEmailDomain("a@example.net")).toBe(true);
    expect(isReservedEmailDomain("a@example.org")).toBe(true);
    expect(isReservedEmailDomain("a@localhost")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isReservedEmailDomain("a@EXAMPLE.com")).toBe(true);
  });

  it("allows normal domains", () => {
    expect(isReservedEmailDomain("a@gmail.com")).toBe(false);
  });
});

describe("canEmailDomainReceiveMail", () => {
  it("returns true when the domain has MX records", async () => {
    resolveMxImpl = () => Promise.resolve([{ exchange: "mx1.gmail.com", priority: 10 }]);
    await expect(canEmailDomainReceiveMail("a@gmail.com")).resolves.toBe(true);
    expect(resolveMxCalls).toEqual(["gmail.com"]);
  });

  it("returns false when the domain has no MX records", async () => {
    resolveMxImpl = () => Promise.resolve([]);
    await expect(canEmailDomainReceiveMail("a@nomail.example.dev")).resolves.toBe(false);
  });

  it("returns false when the lookup fails", async () => {
    resolveMxImpl = () => Promise.reject(new Error("ENOTFOUND"));
    await expect(canEmailDomainReceiveMail("a@doesnotexist.pk")).resolves.toBe(false);
  });

  it("short-circuits reserved domains without any lookup", async () => {
    await expect(canEmailDomainReceiveMail("a@example.com")).resolves.toBe(false);
    expect(resolveMxCalls).toHaveLength(0);
  });

  it("short-circuits when there is no domain at all", async () => {
    await expect(canEmailDomainReceiveMail("not-an-email")).resolves.toBe(false);
    expect(resolveMxCalls).toHaveLength(0);
  });

  it(
    "returns false when the lookup hangs past the 3-second timeout",
    async () => {
      // Deliberately slow test (~3s): the DNS promise never settles, so the
      // real internal timeout has to fire and reject the race.
      resolveMxImpl = () => new Promise(() => {});
      await expect(canEmailDomainReceiveMail("a@slow-dns.pk")).resolves.toBe(false);
    },
    8_000
  );
});
