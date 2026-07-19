import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { renderWithProviders } from "./renderWithProviders";
import { server } from "./msw/server";
import { api } from "./msw/handlers";
import { http, HttpResponse } from "msw";

// A component that exercises BOTH providers: it reads via TanStack Query
// (backed by MSW) and grabs a navigate fn from the router (proving the router
// context is present).
function Probe() {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["probe"],
    queryFn: async () => {
      const res = await fetch(api("/probe"));
      return res.json() as Promise<{ ok: string }>;
    },
  });
  return (
    <div>
      <span>nav:{typeof navigate === "function" ? "ready" : "missing"}</span>
      <span>{data ? `data:${data.ok}` : "loading"}</span>
    </div>
  );
}

describe("renderWithProviders harness", () => {
  it("provides router + query context and MSW answers requests", async () => {
    server.use(http.get(api("/probe"), () => HttpResponse.json({ ok: "yes" })));
    renderWithProviders(<Probe />);
    // RouterProvider mounts the tree asynchronously — await the first paint.
    expect(await screen.findByText("nav:ready")).toBeInTheDocument();
    expect(await screen.findByText("data:yes")).toBeInTheDocument();
  });
});
