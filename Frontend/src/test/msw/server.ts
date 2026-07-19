import { setupServer } from "msw/node";
import { handlers } from "./handlers";

// One MSW server shared across the whole test run. Lifecycle (listen / reset /
// close) is wired in src/test/setup.ts so every test file gets a clean slate.
export const server = setupServer(...handlers);
