import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";
import Landing from "../modules/marketing/pages/Landing";

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Landing,
});

const routeTree = rootRoute.addChildren([indexRoute]);

export const router = createRouter({ routeTree });
