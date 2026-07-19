import { http, HttpResponse } from "msw";

// Base URL is pinned in vite.config.ts test.env → matches the app's axios base.
const API = "http://localhost:5000/api";

// Build a full URL for a handler path.
export const api = (path: string) => `${API}${path}`;

// A small default set so an unrelated request never 404s a component under
// test. Individual tests override these with server.use(...).
export const handlers = [
  http.get(api("/auth/me"), () =>
    HttpResponse.json({ user: { id: "u1", email: "test@lawflow.pk", role: "client" } })
  ),
];
