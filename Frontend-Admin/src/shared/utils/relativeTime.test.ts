import { describe, it, expect, afterEach, vi } from "vitest";
import { formatRelativeTime } from "./relativeTime";

afterEach(() => vi.useRealTimers());

describe("formatRelativeTime", () => {
  it("returns empty string for nullish and echoes unparseable input", () => {
    expect(formatRelativeTime(null)).toBe("");
    expect(formatRelativeTime(undefined)).toBe("");
    expect(formatRelativeTime("not-a-date")).toBe("not-a-date");
  });

  it('reads "just now" under 45 seconds, including future clock skew', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T10:00:00Z"));
    expect(formatRelativeTime("2026-07-16T09:59:30Z")).toBe("just now");
    expect(formatRelativeTime("2026-07-16T10:00:05Z")).toBe("just now"); // future
  });

  it("scales through minutes, hours, days, months, years with correct plurals", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T10:00:00Z"));
    expect(formatRelativeTime("2026-07-16T09:59:00Z")).toBe("1 minute ago");
    expect(formatRelativeTime("2026-07-16T09:57:00Z")).toBe("3 minutes ago");
    expect(formatRelativeTime("2026-07-16T09:00:00Z")).toBe("1 hour ago");
    expect(formatRelativeTime("2026-07-15T10:00:00Z")).toBe("1 day ago");
    expect(formatRelativeTime("2026-06-16T10:00:00Z")).toBe("1 month ago");
    expect(formatRelativeTime("2025-07-16T10:00:00Z")).toBe("1 year ago");
  });
});
