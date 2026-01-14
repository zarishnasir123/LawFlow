import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";
import Landing from "../modules/marketing/pages/Landing";
import Register from "../modules/auth/pages/Register";
import Login from "../modules/auth/pages/Login";
import ForgotPassword from "../modules/auth/pages/ForgotPassword";
import ClientDashboard from "../modules/client/pages/Dashboard";
import LawyerDashboard from "../modules/lawyer/pages/Dashboard";
import FindLawyer from "../modules/client/pages/FindLawyer";
import LawyerCases from "../modules/lawyer/pages/Cases";
import LawyerHearings from "../modules/lawyer/pages/Hearings";
// import AdminDashboard from "../modules/admin/pages/Dashboard";
import ClientProfile from "../modules/client/pages/ClientProfile";
import ClientEditProfile from "../modules/client/pages/ClientEditProfile";
import AiLegalGuidance from "../modules/lawyer/pages/AiLegalGuidance";

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

// export const adminDashboardRoute = createRoute({
//   getParentRoute: () => rootRoute,
//   path: "admin-dashboard",
//   component: AdminDashboard,
// });

const lawyerCasesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "lawyer-cases",
  component: LawyerCases,
});

const lawyerHearingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "lawyer-hearings",
  component: LawyerHearings,
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

export const clientProfileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/client-profile",
  component: ClientProfile,
});

export const clienteditProfileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/client-profile/edit",
  component: ClientEditProfile,
});

export const lawyerAiGuidanceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/lawyer-ai-guidance",
  component: AiLegalGuidance,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  registerRoute,
  loginRoute,
  forgotPasswordRoute,
  clientDashboardRoute,
  lawyerDashboardRoute,
  // adminDashboardRoute,
  lawyerCasesRoute,
  lawyerHearingsRoute,
  lawyerAiGuidanceRoute,
  findLawyerRoute,
  registrarDashboardRoute, // Added registrar dashboard to tree
  clientProfileRoute,
  clienteditProfileRoute,
]);

export const router = createRouter({ routeTree });

// Add this for better intellisense
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
