import { type ComponentType, type ReactNode } from "react";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

// Render a component inside the two providers real pages need: a fresh
// TanStack Query client (retries off, so a failed request surfaces its error
// immediately instead of hanging the test) and a memory-history router (so
// useNavigate / router hooks work without a real browser URL). Navigation to
// any path is a no-op render — the root route matches everything — so a form
// that navigates on success won't crash; assert on the mutation/MSW call
// instead. Always `await findBy*` after render so async effects settle.
export function renderWithProviders(
  ui: ReactNode,
  { route = "/" }: { route?: string } = {}
) {
  const queryClient = makeQueryClient();

  const rootRoute = createRootRoute({ component: () => <>{ui}</> });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: [route] }),
  });

  const result = render(
    <QueryClientProvider client={queryClient}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <RouterProvider router={router as any} />
    </QueryClientProvider>
  );

  return { ...result, queryClient, router };
}

// Some pages read the URL through `useSearch({ from: "/some-path" })`, which
// only resolves when a route with that exact id exists. This mounts the page
// as that route so search params (e.g. ?token=… on the reset-password link)
// behave exactly as they do in the real app.
export function renderRoute(
  Component: ComponentType,
  {
    path,
    search = {},
  }: { path: string; search?: Record<string, string | number | boolean> }
) {
  const queryClient = makeQueryClient();

  const rootRoute = createRootRoute();
  const pageRoute = createRoute({
    getParentRoute: () => rootRoute,
    path,
    // Wrap so a class OR function component satisfies RouteComponent.
    component: () => <Component />,
    validateSearch: (raw: Record<string, unknown>) => raw,
  });
  const routeTree = rootRoute.addChildren([pageRoute]);

  const query = new URLSearchParams(
    Object.entries(search).map(([k, v]) => [k, String(v)])
  ).toString();

  const router = createRouter({
    routeTree,
    history: createMemoryHistory({
      initialEntries: [query ? `${path}?${query}` : path],
    }),
  });

  const result = render(
    <QueryClientProvider client={queryClient}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <RouterProvider router={router as any} />
    </QueryClientProvider>
  );

  return { ...result, queryClient, router };
}
