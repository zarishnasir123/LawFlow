import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";

/* ================= AUTH ================= */
import Landing from "../modules/marketing/pages/Landing";
import Register from "../modules/auth/pages/Register";
import Login from "../modules/auth/pages/Login";
import ForgotPassword from "../modules/auth/pages/ForgotPassword";

/* ================= CLIENT ================= */
import ClientDashboard from "../modules/client/pages/Dashboard";
import ClientProfile from "../modules/client/pages/ClientProfile";
import ClientEditProfile from "../modules/client/pages/ClientEditProfile";
import ClientMessages from "../modules/client/pages/Messages";
import ClientChatDetail from "../modules/client/pages/ChatDetail";
import ClientHearings from "../modules/client/pages/Hearings";
import FindLawyer from "../modules/client/pages/FindLawyer";
import CaseTracking from "../modules/client/pages/CaseTracking";

/* ================= LAWYER ================= */
import LawyerDashboard from "../modules/lawyer/pages/Dashboard";
import LawyerCases from "../modules/lawyer/pages/Cases";
import ReturnedCases from "../modules/lawyer/pages/ReturnedCases";
import ReturnedCaseDetail from "../modules/lawyer/pages/ReturnedCaseDetail";
import CreateCase from "../modules/lawyer/pages/CreateCase";
import LawyerNewCase from "../modules/lawyer/pages/LawyerNewCase";
import LawyerProfile from "../modules/lawyer/pages/LawyerProfile";
import LawyerProfileEdit from "../modules/lawyer/pages/LawyerProfileEdit";
import LawyerHearings from "../modules/lawyer/pages/Hearings";
import LawyerMessages from "../modules/lawyer/pages/Messages";
import ChatDetail from "../modules/lawyer/pages/ChatDetail";
import AiLegalGuidance from "../modules/lawyer/pages/AiLegalGuidance";
import ServiceCharges from "../modules/lawyer/pages/ServiceCharges";
import CaseDocumentEditor from "../modules/lawyer/pages/CaseDocumentEditor";

/* ================= REGISTRAR ================= */
import { ViewCases } from "../modules/registrar/pages/viewCases";
import { RegistrarDashboard } from "../modules/registrar/pages/Dashboard";
import ReviewCases from "../modules/registrar/pages/ReviewCases";
import ApprovedCases from "../modules/registrar/pages/ApprovedCases";
import ReturnCase from "../modules/registrar/pages/ReturnCase";
import ScheduleHearing from "../modules/registrar/pages/ScheduleHearing";

/* ================= ADMIN ================= */
import AdminDashboardPage from "../modules/admin/pages/Dashboard";
import AdminRegistrarsPage from "../modules/admin/pages/Registrars";
import AdminStatisticPage from "../modules/admin/pages/Reports";
import AdminVerificationsPage from "../modules/admin/pages/Verifications";
import AdminProfilePage from "../modules/admin/pages/Profile";
import AdminNotificationsPage from "../modules/admin/pages/Notifications";
import CreateRegistrar from "../modules/admin/pages/CreateRegistrar";
import EditRegistrar from "../modules/admin/pages/EditRegistrar";

/* ================= TEMPLATES ================= */
import ManageTemplates from "../modules/admin/pages/ManageTemplates";
import CreateTemplate from "../modules/admin/pages/CreateTemplate";
import EditTemplate from "../modules/admin/pages/EditTemplate";

/* ================= ROOT ================= */
const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

/* ================= BASIC ================= */
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

/* ================= ADMIN ROUTES ================= */
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

const adminCreateRegistrarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "admin-registrars/create",
  component: CreateRegistrar,
});

const adminEditRegistrarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "admin-registrars/edit/$id",
  component: EditRegistrar,
});

/* ===== TEMPLATES ===== */
const adminTemplatesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "admin-templates",
  component: ManageTemplates,
});

const adminCreateTemplateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "admin-templates/create",
  component: CreateTemplate,
});

const adminEditTemplateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "admin-templates/edit/$id",
  component: EditTemplate,
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

/* ================= ROUTE TREE (NO DUPLICATES) ================= */
const routeTree = rootRoute.addChildren([
  indexRoute,
  registerRoute,
  loginRoute,
  forgotPasswordRoute,

  adminDashboardRoute,
adminRegistrarsRoute,
adminCreateRegistrarRoute,
adminEditRegistrarRoute,

adminTemplatesRoute,
adminCreateTemplateRoute,
adminEditTemplateRoute,

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
