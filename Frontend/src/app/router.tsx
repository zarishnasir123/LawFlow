import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";

/* =========================
   MARKETING & AUTH
========================= */
import Landing from "../modules/marketing/pages/Landing";
import Register from "../modules/auth/pages/Register";
import Login from "../modules/auth/pages/Login";
import ForgotPassword from "../modules/auth/pages/ForgotPassword";

/* =========================
   CLIENT
========================= */
import ClientDashboard from "../modules/client/pages/Dashboard";
import ClientProfile from "../modules/client/pages/ClientProfile";
import ClientEditProfile from "../modules/client/pages/ClientEditProfile";
import ClientMessages from "../modules/client/pages/Messages";
import ClientChatDetail from "../modules/client/pages/ChatDetail";

/* =========================
   LAWYER
========================= */
import LawyerDashboard from "../modules/lawyer/pages/Dashboard";
import LawyerCases from "../modules/lawyer/pages/Cases";
import ReturnedCases from "../modules/lawyer/pages/ReturnedCases";
import ReturnedCaseDetail from "../modules/lawyer/pages/ReturnedCaseDetail";
import CreateCase from "../modules/lawyer/pages/CreateCase";
import LawyerProfile from "../modules/lawyer/pages/LawyerProfile";
import LawyerProfileEdit from "../modules/lawyer/pages/LawyerProfileEdit";
import LawyerNewCase from "../modules/lawyer/pages/LawyerNewCase";
import LawyerMessages from "../modules/lawyer/pages/Messages";
import LawyerChatDetail from "../modules/lawyer/pages/ChatDetail";
import LawyerHearings from "../modules/lawyer/pages/Hearings";
import CaseDocumentEditor from "../modules/lawyer/pages/CaseDocumentEditor";

/* =========================
   REGISTRAR
========================= */
import { RegistrarDashboard } from "../modules/registrar/pages/Dashboard";
import ReviewCases from "../modules/registrar/pages/ReviewCases";

/* =========================
   ADMIN
========================= */
import AdminDashboardPage from "../modules/admin/pages/Dashboard";
import AdminRegistrarsPage from "../modules/admin/pages/Registrars";
import CreateRegistrar from "../modules/admin/pages/CreateRegistrar";
import EditRegistrar from "../modules/admin/pages/EditRegistrar";
import AdminStatisticPage from "../modules/admin/pages/Reports";
import AdminVerificationsPage from "../modules/admin/pages/Verifications";
import AdminProfilePage from "../modules/admin/pages/Profile";
import AdminNotificationsPage from "../modules/admin/pages/Notifications";

/* =========================
   ADMIN TEMPLATES
========================= */
import ManageTemplates from "../modules/admin/pages/ManageTemplates";
import CreateTemplate from "../modules/admin/pages/CreateTemplate";
import EditTemplate from "../modules/admin/pages/EditTemplate";

/* =========================
   ROOT
========================= */
const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

/* =========================
   AUTH ROUTES
========================= */
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

/* =========================
   CLIENT ROUTES
========================= */
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

const clientMessagesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "client-messages",
  component: ClientMessages,
});

const clientChatDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "client-chat/$threadId",
  component: ClientChatDetail,
});

/* =========================
   LAWYER ROUTES
========================= */
const lawyerDashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "lawyer-dashboard",
  component: LawyerDashboard,
});

const lawyerCasesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "lawyer-cases",
  component: LawyerCases,
});

const lawyerCreateCaseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "lawyer-create-case",
  component: CreateCase,
});

const lawyerReturnedCasesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "lawyer-returned-cases",
  component: ReturnedCases,
});

const lawyerReturnedCaseDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "lawyer-case-detail/$caseId",
  component: ReturnedCaseDetail,
});

const lawyerProfileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "lawyer-profile",
  component: LawyerProfile,
});

const lawyerProfileEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "lawyer-profile/edit",
  component: LawyerProfileEdit,
});

const lawyerNewCaseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "lawyer-new-case",
  component: LawyerNewCase,
});

const lawyerMessagesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "lawyer-messages",
  component: LawyerMessages,
});

const lawyerChatDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "lawyer-chat/$threadId",
  component: LawyerChatDetail,
});

const lawyerHearingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "lawyer-hearings",
  component: LawyerHearings,
});

const lawyerCaseDocumentEditorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "lawyer-case-document-editor",
  component: CaseDocumentEditor,
});

/* =========================
   REGISTRAR ROUTES
========================= */
const registrarDashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "registrar-dashboard",
  component: () => (
    <RegistrarDashboard
      logout={() => {
        localStorage.clear();
        window.location.href = "/login";
      }}
    />
  ),
});

const reviewCasesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "review-cases/$caseId",
  component: ReviewCases,
});

/* =========================
   ADMIN ROUTES
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

/* =========================
   ADMIN TEMPLATE ROUTES
========================= */
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
  clientMessagesRoute,
  clientChatDetailRoute,

  lawyerDashboardRoute,
  lawyerCasesRoute,
  lawyerCreateCaseRoute,
  lawyerReturnedCasesRoute,
  lawyerReturnedCaseDetailRoute,
  lawyerProfileRoute,
  lawyerProfileEditRoute,
  lawyerNewCaseRoute,
  lawyerMessagesRoute,
  lawyerChatDetailRoute,
  lawyerHearingsRoute,
  lawyerCaseDocumentEditorRoute,

  registrarDashboardRoute,
  reviewCasesRoute,

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
