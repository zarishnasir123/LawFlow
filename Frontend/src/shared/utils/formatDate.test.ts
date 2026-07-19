import { describe, it, expect, afterEach, vi } from "vitest";
import { formatDate } from "./formatDate";

afterEach(() => vi.useRealTimers());

describe("formatDate", () => {
  it("returns empty string for an invalid date", () => {
    expect(formatDate("not-a-date")).toBe("");
    expect(formatDate(NaN)).toBe("");
  });

  it("formats the ISO output", () => {
    expect(formatDate("2026-07-16T10:00:00.000Z", "iso")).toBe(
      "2026-07-16T10:00:00.000Z"
    );
  });

  it("formats a plain date in en-GB day-month-year", () => {
    // Use a midday UTC time so the local calendar day is stable across zones.
    expect(formatDate("2026-07-16T12:00:00Z", "date")).toMatch(/16 Jul 2026/);
  });

  it("formats a short numeric date", () => {
    expect(formatDate("2026-07-16T12:00:00Z", "shortDate")).toMatch(/16\/7\/26/);
  });

  describe("relative", () => {
    it('reads "Just now" under a minute', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-07-16T10:00:30Z"));
      expect(formatDate("2026-07-16T10:00:00Z", "relative")).toBe("Just now");
    });

    it("uses singular vs plural minutes and hours", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-07-16T10:00:00Z"));
      expect(formatDate("2026-07-16T09:59:00Z", "relative")).toBe("1 minute ago");
      expect(formatDate("2026-07-16T09:57:00Z", "relative")).toBe("3 minutes ago");
      expect(formatDate("2026-07-16T09:00:00Z", "relative")).toBe("1 hour ago");
      expect(formatDate("2026-07-16T07:00:00Z", "relative")).toBe("3 hours ago");
    });

    it("reads days up to a week, then falls back to a plain date", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-07-16T10:00:00Z"));
      expect(formatDate("2026-07-15T10:00:00Z", "relative")).toBe("1 day ago");
      expect(formatDate("2026-07-13T10:00:00Z", "relative")).toBe("3 days ago");
      // 10 days ago → beyond a week → falls through to the "date" format.
      expect(formatDate("2026-07-06T12:00:00Z", "relative")).toMatch(/Jul 2026/);
    });
  });
});
