import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";
import Landing from "../modules/marketing/pages/Landing";
import Register from "../modules/auth/pages/Register";
import Login from "../modules/auth/pages/Login";
import ForgotPassword from "../modules/auth/pages/ForgotPassword";
import ClientDashboard from "../modules/client/pages/Dashboard";
 import LawyerDashboard from "../modules/lawyer/pages/Dashboard";
import FindLawyer from "../modules/client/pages/FindLawyer";

// Only Registrar Dashboard Import
import { RegistrarDashboard } from "../modules/registrar/pages/Dashboard";

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

const lawyerDashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "Lawyer-dashboard",
  component: LawyerDashboard,
});

export const findLawyerRoute = createRoute({
  getParentRoute: () => rootRoute, 
  path: "FindLawyer",              
  component: FindLawyer,
});

// Registrar Dashboard Route with navigate and logout props
const registrarDashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "registrar-dashboard",
  component: () => (
    <RegistrarDashboard 
      navigate={(page, data) => {
        // TanStack Router handles navigation here
        router.navigate({ to: page, search: data });
      }}
      logout={() => {
        // Simple logout logic
        localStorage.clear();
        router.navigate({ to: "/login" });
      }}
    />
  ),
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  registerRoute,
  loginRoute,
  forgotPasswordRoute,
  clientDashboardRoute,
  lawyerDashboardRoute,
  findLawyerRoute,
  registrarDashboardRoute, // Added registrar dashboard to tree
]);

export const router = createRouter({ routeTree });

// Add this for better intellisense
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}