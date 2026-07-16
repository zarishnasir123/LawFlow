import { describe, it, expect, afterEach, vi } from "vitest";
import {
  getSupabaseStorageConfig,
  getSupabaseClient,
  requireSupabaseClient,
} from "../../../src/config/supabase.js";

afterEach(() => vi.unstubAllEnvs());

const configure = () => {
  vi.stubEnv("SUPABASE_URL", "https://fake-project.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fake-service-role-key");
};

describe("getSupabaseStorageConfig", () => {
  it("reports console mode with the missing keys when nothing is configured", () => {
    vi.stubEnv("SUPABASE_URL", undefined);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", undefined);
    const config = getSupabaseStorageConfig();
    expect(config.mode).toBe("console");
    expect(config.issues).toEqual(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  });

  it("treats template placeholder values as unconfigured", () => {
    vi.stubEnv("SUPABASE_URL", "your_supabase_url");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "PUT_SUPABASE_SERVICE_ROLE_KEY_HERE");
    expect(getSupabaseStorageConfig().mode).toBe("console");
  });

  it("reports supabase mode when both values are real", () => {
    configure();
    const config = getSupabaseStorageConfig();
    expect(config.mode).toBe("supabase");
    expect(config.issues).toEqual([]);
  });

  it("provides a default name for every bucket", () => {
    const config = getSupabaseStorageConfig();
    expect(config.bucket).toBe("lawyer-verification-documents");
    expect(config.casePdfBucket).toBe("case-signed-pdfs");
    expect(config.avatarBucket).toBe("user-avatars");
    expect(config.caseAttachmentBucket).toBe("case-attachments");
    expect(config.payoutReceiptBucket).toBe("payout-receipts");
    expect(config.chatAttachmentBucket).toBe("chat-attachments");
    expect(config.caseTemplateBucket).toBe("case-type-templates");
  });

  it("lets env vars override bucket names", () => {
    vi.stubEnv("SUPABASE_AVATAR_BUCKET", "custom-avatars");
    expect(getSupabaseStorageConfig().avatarBucket).toBe("custom-avatars");
  });

  it("falls back to 900s preview expiry for missing or invalid values", () => {
    expect(getSupabaseStorageConfig().previewUrlExpiresIn).toBe(900);
    vi.stubEnv("SUPABASE_PREVIEW_URL_EXPIRES_IN", "-5");
    expect(getSupabaseStorageConfig().previewUrlExpiresIn).toBe(900);
    vi.stubEnv("SUPABASE_PREVIEW_URL_EXPIRES_IN", "300");
    expect(getSupabaseStorageConfig().previewUrlExpiresIn).toBe(300);
  });
});

describe("getSupabaseClient / requireSupabaseClient", () => {
  it("returns null (and 503 from require) when unconfigured", () => {
    vi.stubEnv("SUPABASE_URL", undefined);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", undefined);
    expect(getSupabaseClient()).toBeNull();
    expect(() => requireSupabaseClient()).toThrow(/not configured/);
    try {
      requireSupabaseClient();
    } catch (err) {
      expect(err.statusCode).toBe(503);
    }
  });

  it("builds a client when configured and caches it for the same credentials", () => {
    configure();
    const first = getSupabaseClient();
    const second = getSupabaseClient();
    expect(first).not.toBeNull();
    expect(second).toBe(first); // same instance, no rebuild
  });

  it("rebuilds the client when the credentials change", () => {
    configure();
    const first = getSupabaseClient();
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "rotated-key");
    const second = getSupabaseClient();
    expect(second).not.toBe(first);
  });
});
