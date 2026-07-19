import { describe, it, expect } from "vitest";
import { derivePageLabel } from "./pageLabel";

// jsdom is the test environment, so we can build real <section> elements.
function page(html: string): HTMLElement {
  const el = document.createElement("section");
  el.innerHTML = html;
  return el;
}

describe("derivePageLabel", () => {
  it("prefers a heading, stripping decorative dashes", () => {
    expect(derivePageLabel(page("<h2>── Cause Title ──</h2>"), "fallback")).toBe("Cause Title");
  });

  it("uses a dashed section-title paragraph when there is no heading", () => {
    expect(derivePageLabel(page("<p>── Verification ──</p>"), "fallback")).toBe("Verification");
  });

  it("uses the first meaningful paragraph, truncating long text", () => {
    const long = "x".repeat(60);
    const label = derivePageLabel(page(`<p>${long}</p>`), "fallback");
    expect(label.endsWith("…")).toBe(true);
    expect(label.length).toBeLessThanOrEqual(41);
  });

  it("returns the fallback when the page has nothing usable", () => {
    expect(derivePageLabel(page("<p>  </p>"), "Page 3")).toBe("Page 3");
    expect(derivePageLabel(page(""), "Page 3")).toBe("Page 3");
  });
});
