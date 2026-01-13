import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";
import Landing from "../modules/marketing/pages/Landing";
import Register from "../modules/auth/pages/Register";
import Login from "../modules/auth/pages/Login";
import ForgotPassword from "../modules/auth/pages/ForgotPassword";
import ClientDashboard from "../modules/client/pages/Dashboard";
import FindLawyer from "../modules/client/pages/FindLawyer";


const rootRoute = createRootRoute({  
  component: () => <Outlet />,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Landing,
});

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "register",
  component: Register,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "login",
  component: Login,
});

const forgotPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "forgot-password",
  component: ForgotPassword,
});

const clientDashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "client-dashboard",
  component: ClientDashboard,
});

export const findLawyerRoute = createRoute({
  getParentRoute: () => rootRoute, 
  path: "FindLawyer",             
  component: FindLawyer,
});


const routeTree = rootRoute.addChildren([
  indexRoute,
  registerRoute,
  loginRoute,
  forgotPasswordRoute,
  clientDashboardRoute,
  findLawyerRoute,
]);

export const router = createRouter({ routeTree });
