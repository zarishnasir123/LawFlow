import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";

/* =====================================================
   MARKETING & AUTHENTICATION IMPORTS
   ===================================================== */
import Landing from "../modules/marketing/pages/Landing";
import Register from "../modules/auth/pages/Register";
import Login from "../modules/auth/pages/Login";
import ForgotPassword from "../modules/auth/pages/ForgotPassword";

/* =====================================================
   CLIENT MODULE IMPORTS
   ===================================================== */
import ClientDashboard from "../modules/client/pages/Dashboard";
import ClientProfile from "../modules/client/pages/ClientProfile";
import ClientEditProfile from "../modules/client/pages/ClientEditProfile";
import ClientMessages from "../modules/client/pages/Messages";
import ClientChatDetail from "../modules/client/pages/ChatDetail";
import ClientHearings from "../modules/client/pages/Hearings";
import FindLawyer from "../modules/client/pages/FindLawyer";
import CaseTracking from "../modules/client/pages/CaseTracking";

/* =====================================================
   LAWYER MODULE IMPORTS
   ===================================================== */
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

/* =====================================================
   REGISTRAR MODULE IMPORTS
   ===================================================== */
import { ViewCases } from "../modules/registrar/pages/viewCases";
import { RegistrarDashboard } from "../modules/registrar/pages/Dashboard";
import ReviewCases from "../modules/registrar/pages/ReviewCases";
import ApprovedCases from "../modules/registrar/pages/ApprovedCases";
import ReturnCase from "../modules/registrar/pages/ReturnCase";
import ScheduleHearing from "../modules/registrar/pages/ScheduleHearing";


/* =====================================================
   ADMIN MODULE IMPORTS
   ===================================================== */
import AdminDashboardPage from "../modules/admin/pages/Dashboard";
import AdminRegistrarsPage from "../modules/admin/pages/Registrars";
import AdminStatisticPage from "../modules/admin/pages/Reports";
import AdminVerificationsPage from "../modules/admin/pages/Verifications";
import AdminProfilePage from "../modules/admin/pages/Profile";
import AdminNotificationsPage from "../modules/admin/pages/Notifications";
import CreateRegistrar from "../modules/admin/pages/CreateRegistrar";
import EditRegistrar from "../modules/admin/pages/EditRegistrar";

/* =====================================================
   ROOT ROUTE - Base layout wrapper for all routes
   ===================================================== */
const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

/* =====================================================
   MARKETING & AUTHENTICATION ROUTES
   1. Landing page
   2. User registration
   3. User login
   4. Password recovery
   ===================================================== */

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

/* =====================================================
   CLIENT ROUTES
   1. Dashboard - Main client hub
   2. Profile - View/edit client profile
   3. Messages - Client messaging interface
   4. Chat Detail - Individual chat thread
   5. Hearings - Client hearing schedules
   6. Find Lawyer - Search and browse lawyers
   7. Case Tracking - Track case progress
   ===================================================== */

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

export const findLawyerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "FindLawyer",
  component: FindLawyer,
});

export const casetrackingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "case-tracking",
  component: CaseTracking,
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

const clientHearingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "client-hearings",
  component: ClientHearings,
});

/* =====================================================
   LAWYER ROUTES
   1. Dashboard - Main lawyer hub
   2. Cases - Manage lawyer cases
   3. Hearings - Lawyer hearing schedules
   4. Messages - Lawyer messaging interface
   5. Chat Detail - Individual chat thread
   6. AI Legal Guidance - AI assistance tool
   7. Service Charges - Manage service fees
   ===================================================== */

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

const lawyerCreateCaseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "lawyer-create-case",
  component: CreateCase,
});

const lawyerNewCaseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "lawyer-new-case",
  component: LawyerNewCase,
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

const lawyerHearingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "lawyer-hearings",
  component: LawyerHearings,
});

const lawyerMessagesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "lawyer-messages",
  component: LawyerMessages,
});

const lawyerChatDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "lawyer-chat/$threadId",
  component: ChatDetail,
});

const lawyerAiGuidanceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "lawyer-ai-guidance",
  component: AiLegalGuidance,
});

const serviceChargesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "lawyer-service-charges",
  component: ServiceCharges,
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

const caseDocumentEditorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "lawyer-case-editor",
  component: CaseDocumentEditor,
});

const caseDocumentEditorDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "lawyer-case-editor/$caseId",
  component: CaseDocumentEditor,
});

/* =====================================================
   REGISTRAR ROUTES
   1. Dashboard - Main registrar hub
   2. View Cases - Browse all cases
   3. Review Cases - Review pending cases (dynamic: caseId)
   4. Approved Cases - View approved cases
   5. Return Case - Handle case returns
   ===================================================== */

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

const scheduleHearingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "schedule-hearing/$caseId",
  component: ScheduleHearing,
});

/* =====================================================
   ADMIN ROUTES
   1. Dashboard - Main admin hub
   2. Registrars - Manage registrar accounts
      a. Create Registrar - Add new registrar
      b. Edit Registrar - Update registrar details
   3. Statistics - View system reports & analytics
   4. Verifications - Handle user verifications
   5. Profile - Admin profile management
   6. Notifications - System notifications
   ===================================================== */

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

// Admin Sub-route: Create Registrar
const adminCreateRegistrarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "admin-registrars/create",
  component: CreateRegistrar,
});

// Admin Sub-route: Edit Registrar (dynamic: id)
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

/* =====================================================
   ROUTE TREE - Combines all routes into hierarchy
   ===================================================== */

const routeTree = rootRoute.addChildren([
  // Marketing & Auth
  indexRoute,
  registerRoute,
  loginRoute,
  forgotPasswordRoute,

  // Client Routes
  clientDashboardRoute,
  clientProfileRoute,
  clientEditProfileRoute,
  clientMessagesRoute,
  clientChatDetailRoute,
  clientHearingsRoute,
  findLawyerRoute,
  casetrackingRoute,

  // Lawyer Routes
  lawyerDashboardRoute,
  lawyerCasesRoute,
  lawyerCreateCaseRoute,
  lawyerNewCaseRoute,
  lawyerReturnedCasesRoute,
  lawyerReturnedCaseDetailRoute,
  lawyerProfileRoute,
  lawyerProfileEditRoute,
  caseDocumentEditorRoute,
  caseDocumentEditorDetailRoute,
  lawyerHearingsRoute,
  lawyerMessagesRoute,
  lawyerChatDetailRoute,
  lawyerAiGuidanceRoute,
  serviceChargesRoute,

  // Registrar Routes
  viewCasesRoute,
  registrarDashboardRoute,
  reviewCasesRoute,
  approvedCasesRoute,
  returnCaseRoute,
  scheduleHearingRoute,

  // Admin Routes
  adminDashboardRoute,
  adminRegistrarsRoute,
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