import { describe, it, expect } from "vitest";
import { forceDownloadUrl } from "./chatAttachmentUrl";

describe("forceDownloadUrl", () => {
  it("adds ?download when the URL has no query string", () => {
    expect(forceDownloadUrl("https://x.co/file.pdf", "plaint.pdf")).toBe(
      "https://x.co/file.pdf?download=plaint.pdf"
    );
  });

  it("adds &download when the URL already has a query string", () => {
    expect(forceDownloadUrl("https://x.co/file.pdf?token=abc", "plaint.pdf")).toBe(
      "https://x.co/file.pdf?token=abc&download=plaint.pdf"
    );
  });

  it("URL-encodes the filename", () => {
    expect(forceDownloadUrl("https://x.co/f", "my file (1).pdf")).toBe(
      "https://x.co/f?download=my%20file%20(1).pdf"
    );
  });

  it('falls back to "download" for an empty filename', () => {
    expect(forceDownloadUrl("https://x.co/f", "")).toBe("https://x.co/f?download=download");
  });
});
