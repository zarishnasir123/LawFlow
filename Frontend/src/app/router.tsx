// src/app/router.tsx
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
import ClientProfile from "../modules/client/pages/ClientProfile";
import ClientEditProfile from "../modules/client/pages/ClientEditProfile";

import LawyerDashboard from "../modules/lawyer/pages/Dashboard";
import LawyerCases from "../modules/lawyer/pages/Cases";
import LawyerHearings from "../modules/lawyer/pages/Hearings";
import AiLegalGuidance from "../modules/lawyer/pages/AiLegalGuidance";

import FindLawyer from "../modules/client/pages/FindLawyer";

import { ViewCases } from "../modules/registrar/pages/viewCases";
import { RegistrarDashboard } from "../modules/registrar/pages/Dashboard";

// ✅ Admin pages (make sure these files exist and have `export default ...`)
import AdminDashboardPage from "../modules/admin/pages/Dashboard";
import Registrars from "../modules/admin/pages/Registrars";
import Reports from "../modules/admin/pages/Reports";
import Verifications from "../modules/admin/pages/Verifications";
import Profile from "../modules/admin/pages/Profile";
import Notifications from "../modules/admin/pages/Notifications";

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

const clientProfileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "client-profile",
  component: ClientProfile,
});

const clientEditProfileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "client-profile-edit",
  component: ClientEditProfile,
});

const lawyerDashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "Lawyer-dashboard",
  component: LawyerDashboard,
});

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

const lawyerAiGuidanceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "lawyer-ai-guidance",
  component: AiLegalGuidance,
});

export const findLawyerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "FindLawyer",
  component: FindLawyer,
});

const viewCasesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "view-cases",
  component: ViewCases,
});

const registrarDashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "registrar-dashboard",
  component: () => (
    <RegistrarDashboard
      logout={() => {
        localStorage.clear();
        router.navigate({ to: "/login" });
      }}
    />
  ),
});

// ✅ Admin routes
const adminDashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "admin-dashboard",
  component: AdminDashboardPage,
});

const adminRegistrarsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "admin-registrars",
  component: Registrars,
});

const adminStatisticsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "admin-statistics",
  component: Reports,
});

const adminVerificationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "admin-verifications",
  component: Verifications,
});

const adminProfileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "admin-profile",
  component: Profile,
});

const adminNotificationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "admin-notifications",
  component: Notifications,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  registerRoute,
  loginRoute,
  forgotPasswordRoute,

  clientDashboardRoute,
  clientProfileRoute,
  clientEditProfileRoute,

  lawyerDashboardRoute,
  lawyerCasesRoute,
  lawyerHearingsRoute,
  lawyerAiGuidanceRoute,

  findLawyerRoute,

  viewCasesRoute,
  registrarDashboardRoute,

  // ✅ Admin routes added here
  adminDashboardRoute,
  adminRegistrarsRoute,
  adminStatisticsRoute,
  adminVerificationsRoute,
  adminProfileRoute,
  adminNotificationsRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
