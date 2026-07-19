import { type ReactNode } from "react";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";

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
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

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
