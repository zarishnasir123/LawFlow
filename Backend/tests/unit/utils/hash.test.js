import { describe, it, expect } from "vitest";
import { hashValue, compareHash } from "../../../src/utils/hash.js";

describe("hashValue / compareHash", () => {
  it("hashes a value and verifies it back (round trip)", async () => {
    const hash = await hashValue("Password1!");
    expect(await compareHash("Password1!", hash)).toBe(true);
  });

  it("produces a bcrypt-format hash, never the plain value", async () => {
    const hash = await hashValue("Password1!");
    expect(hash).toMatch(/^\$2/);
    expect(hash).not.toContain("Password1!");
  });

  it("rejects the wrong value", async () => {
    const hash = await hashValue("Password1!");
    expect(await compareHash("password1!", hash)).toBe(false);
    expect(await compareHash("", hash)).toBe(false);
  });

  it("salts every hash (same input, different output)", async () => {
    const first = await hashValue("Password1!");
    const second = await hashValue("Password1!");
    expect(first).not.toBe(second);
    // Yet both still verify.
    expect(await compareHash("Password1!", first)).toBe(true);
    expect(await compareHash("Password1!", second)).toBe(true);
  });
});
