import { describe, it, expect } from "vitest";
import { assertSafeTestDatabaseUrl } from "../../setup/guard.js";

const GOOD_URL = "postgresql://postgres:pw@localhost:5432/lawflow_test";

describe("assertSafeTestDatabaseUrl", () => {
  describe("valid local throwaway URLs are accepted", () => {
    it("accepts a localhost database ending in _test", () => {
      expect(assertSafeTestDatabaseUrl(GOOD_URL)).toEqual({
        url: GOOD_URL,
        databaseName: "lawflow_test",
      });
    });

    it("accepts 127.0.0.1 as host", () => {
      const url = "postgresql://postgres:pw@127.0.0.1:5432/lawflow_test";
      expect(assertSafeTestDatabaseUrl(url).databaseName).toBe("lawflow_test");
    });

    it("accepts an IPv6 loopback host", () => {
      const url = "postgresql://postgres:pw@[::1]:5432/lawflow_test";
      expect(assertSafeTestDatabaseUrl(url).databaseName).toBe("lawflow_test");
    });

    it("accepts a database ending in _e2e (Playwright database)", () => {
      const url = "postgresql://postgres:pw@localhost:5432/lawflow_e2e";
      expect(assertSafeTestDatabaseUrl(url).databaseName).toBe("lawflow_e2e");
    });

    it("trims surrounding whitespace before validating", () => {
      expect(assertSafeTestDatabaseUrl(`  ${GOOD_URL}  `).url).toBe(GOOD_URL);
    });
  });

  describe("missing or malformed input is rejected", () => {
    it("rejects undefined", () => {
      expect(() => assertSafeTestDatabaseUrl(undefined)).toThrow(/TEST_DATABASE_URL is not set/);
    });

    it("rejects an empty string", () => {
      expect(() => assertSafeTestDatabaseUrl("")).toThrow(/TEST_DATABASE_URL is not set/);
    });

    it("rejects a whitespace-only string", () => {
      expect(() => assertSafeTestDatabaseUrl("   ")).toThrow(/TEST_DATABASE_URL is not set/);
    });

    it("rejects a non-string value", () => {
      expect(() => assertSafeTestDatabaseUrl(12345)).toThrow(/TEST_DATABASE_URL is not set/);
    });

    it("rejects a string that is not a URL", () => {
      expect(() => assertSafeTestDatabaseUrl("not a url at all")).toThrow(
        /not a valid connection URL/
      );
    });
  });

  describe("hosted/real databases are rejected", () => {
    it.each(["supabase", "pooler", "amazonaws", "neon", "render"])(
      'rejects URLs containing "%s"',
      (fragment) => {
        const url = `postgresql://postgres:pw@db.${fragment}.co:5432/lawflow_test`;
        expect(() => assertSafeTestDatabaseUrl(url)).toThrow(new RegExp(fragment));
      }
    );

    it("rejects forbidden fragments regardless of letter case", () => {
      const url = "postgresql://postgres:pw@db.SUPABASE.co:5432/lawflow_test";
      expect(() => assertSafeTestDatabaseUrl(url)).toThrow(/supabase/);
    });

    it("rejects a non-local host even without forbidden fragments", () => {
      const url = "postgresql://postgres:pw@my-server.example.com:5432/lawflow_test";
      expect(() => assertSafeTestDatabaseUrl(url)).toThrow(/is not local/);
    });

    it("rejects a LAN IP address", () => {
      const url = "postgresql://postgres:pw@192.168.1.50:5432/lawflow_test";
      expect(() => assertSafeTestDatabaseUrl(url)).toThrow(/is not local/);
    });
  });

  describe("database naming rule", () => {
    it("rejects a database name without the _test/_e2e suffix", () => {
      const url = "postgresql://postgres:pw@localhost:5432/lawflow";
      expect(() => assertSafeTestDatabaseUrl(url)).toThrow(/must end in _test or _e2e/);
    });

    it("rejects the real-sounding name even on localhost", () => {
      const url = "postgresql://postgres:pw@localhost:5432/postgres";
      expect(() => assertSafeTestDatabaseUrl(url)).toThrow(/must end in _test or _e2e/);
    });

    it("rejects an empty database name", () => {
      const url = "postgresql://postgres:pw@localhost:5432/";
      expect(() => assertSafeTestDatabaseUrl(url)).toThrow(/must end in _test or _e2e/);
    });
  });

  describe("collision with the real DATABASE_URL", () => {
    it("rejects a test URL identical to the real one", () => {
      expect(() => assertSafeTestDatabaseUrl(GOOD_URL, GOOD_URL)).toThrow(
        /identical to the DATABASE_URL/
      );
    });

    it("accepts when the real URL is different", () => {
      const real = "postgresql://postgres:pw@localhost:5432/lawflow_dev";
      expect(assertSafeTestDatabaseUrl(GOOD_URL, real).databaseName).toBe("lawflow_test");
    });

    it("accepts when the real URL is null or empty", () => {
      expect(assertSafeTestDatabaseUrl(GOOD_URL, null).databaseName).toBe("lawflow_test");
      expect(assertSafeTestDatabaseUrl(GOOD_URL, "").databaseName).toBe("lawflow_test");
    });
  });
});
