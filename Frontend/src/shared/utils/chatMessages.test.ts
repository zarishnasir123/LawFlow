import { describe, it, expect, afterEach, vi } from "vitest";
import type { ChatMessage } from "../../types/chat";
import {
  upsertMessage,
  replaceMessage,
  messagePreview,
  isSameDay,
  dateSeparatorLabel,
} from "./chatMessages";

const msg = (over: Partial<ChatMessage> = {}): ChatMessage =>
  ({
    id: "m1",
    kind: "text",
    text: "Hello",
    ...over,
  }) as ChatMessage;

afterEach(() => vi.useRealTimers());

describe("upsertMessage", () => {
  it("appends a new message", () => {
    const list = [msg({ id: "m1" })];
    expect(upsertMessage(list, msg({ id: "m2" }))).toHaveLength(2);
  });

  it("ignores a duplicate id (REST reply + WS echo collapse to one)", () => {
    const list = [msg({ id: "m1" })];
    const out = upsertMessage(list, msg({ id: "m1", text: "changed" }));
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe("Hello");
  });
});

describe("replaceMessage", () => {
  it("replaces a message by id", () => {
    const list = [msg({ id: "m1", text: "old" })];
    expect(replaceMessage(list, msg({ id: "m1", text: "new" }))[0].text).toBe("new");
  });

  it("is a no-op when the id is absent", () => {
    const list = [msg({ id: "m1" })];
    expect(replaceMessage(list, msg({ id: "zzz", text: "new" }))).toEqual(list);
  });
});

describe("messagePreview", () => {
  it("labels files and voice notes, echoes text otherwise", () => {
    expect(messagePreview(msg({ kind: "file" }))).toBe("Document");
    expect(messagePreview(msg({ kind: "voice" }))).toBe("Voice message");
    expect(messagePreview(msg({ kind: "text", text: "See you Monday" }))).toBe(
      "See you Monday"
    );
  });
});

describe("isSameDay", () => {
  it("is true within a day, false across days (local calendar day)", () => {
    // Local-noon times keep the calendar day stable regardless of timezone.
    expect(isSameDay("2026-07-16T09:00:00", "2026-07-16T14:00:00")).toBe(true);
    expect(isSameDay("2026-07-16T12:00:00", "2026-07-17T12:00:00")).toBe(false);
  });
});

describe("dateSeparatorLabel", () => {
  it('reads "Today" and "Yesterday" relative to now', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T12:00:00Z"));
    expect(dateSeparatorLabel("2026-07-16T08:00:00Z")).toBe("Today");
    expect(dateSeparatorLabel("2026-07-15T08:00:00Z")).toBe("Yesterday");
  });

  it("shows an absolute date for older messages", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T12:00:00Z"));
    expect(dateSeparatorLabel("2026-06-12T12:00:00Z")).toMatch(/Jun/);
  });
});
