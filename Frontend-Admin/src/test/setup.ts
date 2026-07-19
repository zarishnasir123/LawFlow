import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { setInMemoryAccessToken } from "../modules/auth/utils/authStorage";
import { server } from "./msw/server";

// Fake backend for component/form tests. Unhandled requests error loudly so a
// forgotten handler is obvious rather than a silent hang.
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// jsdom does not implement several browser APIs that pages touch at mount
// time; provide quiet stand-ins so component tests can render.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

// Wrong-role guards call alert(); jsdom has no implementation.
window.alert = vi.fn();

Element.prototype.scrollIntoView =
  vi.fn() as unknown as typeof Element.prototype.scrollIntoView;
URL.createObjectURL = vi.fn(() => "blob:mock") as typeof URL.createObjectURL;
URL.revokeObjectURL = vi.fn() as typeof URL.revokeObjectURL;
HTMLCanvasElement.prototype.getContext = vi.fn(
  () => null
) as unknown as typeof HTMLCanvasElement.prototype.getContext;

afterEach(() => {
  // The access token lives in a module closure and would leak between tests.
  localStorage.clear();
  sessionStorage.clear();
  setInMemoryAccessToken(null);
});
