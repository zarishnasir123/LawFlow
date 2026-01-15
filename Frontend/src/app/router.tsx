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
import LawyerMessages from "../modules/lawyer/pages/Messages";
import ChatDetail from "../modules/lawyer/pages/ChatDetail";
import ClientChatDetail from "../modules/client/pages/ChatDetail";
import ClientMessages from "../modules/client/pages/Messages";
import ServiceCharges from "../modules/lawyer/pages/ServiceCharges";

import FindLawyer from "../modules/client/pages/FindLawyer";

import { ViewCases } from "../modules/registrar/pages/viewCases";
import { RegistrarDashboard } from "../modules/registrar/pages/Dashboard";
import ReviewCases from "../modules/registrar/pages/ReviewCases";
import ApprovedCases from "../modules/registrar/pages/ApprovedCases";
import ReturnCase from "../modules/registrar/pages/ReturnCase";

const reviewCasesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "review-cases/$caseId", // dynamic parameter
  component: ReviewCases,
});


const approvedCasesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "approved-cases",
  component: ApprovedCases,
});

const returnCaseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "return-case",
  component: ReturnCase,
});


// ✅ ADMIN PAGES
import AdminDashboardPage from "../modules/admin/pages/Dashboard";
import AdminRegistrarsPage from "../modules/admin/pages/Registrars";
import AdminStatisticPage from "../modules/admin/pages/Reports";
import AdminVerificationsPage from "../modules/admin/pages/Verifications";
import AdminProfilePage from "../modules/admin/pages/Profile";
import AdminNotificationsPage from "../modules/admin/pages/Notifications";

// ✅ NEW ADMIN REGISTRAR PAGES (ADD THESE)
import CreateRegistrar from "../modules/admin/pages/CreateRegistrar";
import EditRegistrar from "../modules/admin/pages/EditRegistrar";

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

const lawyerMessagesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "lawyer-messages",
  component: LawyerMessages,
});

const clientMessagesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "client-messages",
  component: ClientMessages,
});

const lawyerChatDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "lawyer-chat/$threadId",
  component: ChatDetail,
});

const clientChatDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "client-chat/$threadId",
  component: ClientChatDetail,
});

const serviceChargesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "lawyer-service-charges",
  component: ServiceCharges,
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
        // ✅ avoids router circular reference inside router.tsx
        window.location.href = "/login";
      }}
    />
  ),
});

/* =========================
   ✅ ADMIN ROUTES
   ========================= */

const adminDashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "admin-dashboard",
  component: AdminDashboardPage,
});

const adminRegistrarsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "admin-registrars",
  component: AdminRegistrarsPage,
});

// ✅ NEW: CREATE REGISTRAR
const adminCreateRegistrarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "admin-registrars/create",
  component: CreateRegistrar,
});

// ✅ NEW: EDIT REGISTRAR (TanStack $id)
const adminEditRegistrarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "admin-registrars/edit/$id",
  component: EditRegistrar,
});

const adminStatisticsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "admin-statistics",
  component: AdminStatisticPage,
});

const adminVerificationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "admin-verifications",
  component: AdminVerificationsPage,
});

const adminProfileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "admin-profile",
  component: AdminProfilePage,
});

const adminNotificationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "admin-notifications",
  component: AdminNotificationsPage,
});

/* =========================
   ROUTE TREE
   ========================= */

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
  serviceChargesRoute,

  lawyerMessagesRoute,
  clientMessagesRoute,
  lawyerChatDetailRoute,
  clientChatDetailRoute,
  findLawyerRoute,
  viewCasesRoute,
  registrarDashboardRoute,
  reviewCasesRoute,
  approvedCasesRoute,
 returnCaseRoute,


  // ✅ ADMIN
  adminDashboardRoute,
  adminRegistrarsRoute,

  // ✅ NEW ADMIN REGISTRAR ROUTES
  adminCreateRegistrarRoute,
  adminEditRegistrarRoute,

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
