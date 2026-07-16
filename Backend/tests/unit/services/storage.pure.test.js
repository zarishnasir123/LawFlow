import { describe, it, expect } from "vitest";
import {
  getLawyerStorageRoot,
  parseLawyerKeyFromStoragePath,
  uploadLawyerDocument,
} from "../../../src/services/storage.service.js";

describe("getLawyerStorageRoot", () => {
  it("builds the lawyers/<key> prefix", () => {
    expect(getLawyerStorageRoot("k1")).toBe("lawyers/k1");
  });
});

describe("parseLawyerKeyFromStoragePath", () => {
  it("recovers the lawyer key from a storage path (round trip)", () => {
    expect(parseLawyerKeyFromStoragePath("lawyers/k1/degree.pdf")).toBe("k1");
    expect(parseLawyerKeyFromStoragePath(`${getLawyerStorageRoot("abc-123")}/file.png`)).toBe(
      "abc-123"
    );
  });

  it("returns null for paths outside the lawyers prefix", () => {
    expect(parseLawyerKeyFromStoragePath("avatars/u1/pic.png")).toBeNull();
  });

  it("returns null when the path has no file segment after the key", () => {
    expect(parseLawyerKeyFromStoragePath("lawyers/k1")).toBeNull();
  });

  it("returns null for non-string input", () => {
    expect(parseLawyerKeyFromStoragePath(null)).toBeNull();
    expect(parseLawyerKeyFromStoragePath(undefined)).toBeNull();
    expect(parseLawyerKeyFromStoragePath(42)).toBeNull();
  });
});

describe("uploadLawyerDocument guard rails", () => {
  it("rejects a missing file with a 400 before touching storage", async () => {
    await expect(
      uploadLawyerDocument({ documentType: "law_degree", file: null, lawyerKey: "k1" })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("answers 503 when Supabase storage is not configured (unit env)", async () => {
    // unit.setup.js leaves SUPABASE_* unset, so the client resolves to null.
    await expect(
      uploadLawyerDocument({
        documentType: "law_degree",
        file: { buffer: Buffer.from("pdf"), originalname: "d.pdf", mimetype: "application/pdf" },
        lawyerKey: "k1",
      })
    ).rejects.toMatchObject({ statusCode: 503 });
  });
});
