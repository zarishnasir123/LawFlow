import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";

import { requireAuth } from "./routeGuards";

/* =====================================================
   MARKETING & AUTHENTICATION IMPORTS
   ===================================================== */
import Landing from "../modules/marketing/pages/Landing";
import Register from "../modules/auth/pages/Register";
import Login from "../modules/auth/pages/Login";
import ForgotPassword from "../modules/auth/pages/ForgotPassword";
import VerifyEmail from "../modules/auth/pages/VerifyEmail";
import AuthCallback from "../modules/auth/pages/AuthCallback";
import ResetPassword from "../modules/auth/pages/ResetPassword";

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
import LawyerProfileView from "../modules/client/pages/LawyerProfileView";
import ClientSignatureViewer from "../modules/client/pages/ClientSignatureViewer";
import ClientCasePayments from "../modules/client/pages/CasePayments";
import ClientMyCases from "../modules/client/pages/MyCases";

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
import Signatures from "../modules/lawyer/pages/Signatures";
import LawyerSignatureViewer from "../modules/lawyer/pages/LawyerSignatureViewer";
import CasePaymentPlan from "../modules/lawyer/pages/CasePaymentPlan";
import SubmitCase from "../modules/lawyer/pages/SubmitCase";

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
import AdminRejectionHistoryPage from "../modules/admin/pages/RejectionHistory";
import AdminProfilePage from "../modules/admin/pages/Profile";
import AdminNotificationsPage from "../modules/admin/pages/Notifications";
import CreateRegistrar from "../modules/admin/pages/CreateRegistrar";
import EditRegistrar from "../modules/admin/pages/EditRegistrar";
import AdminTemplatesPage from "../modules/admin/pages/Templates";

/* =====================================================
   ROOT ROUTE - Base layout wrapper for all routes
   ===================================================== */
const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

/* =====================================================
   MARKETING & AUTHENTICATION ROUTES — PUBLIC
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

const verifyEmailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "verify-email",
  component: VerifyEmail,
});

const authCallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "auth/callback",
  component: AuthCallback,
});

const resetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "reset-password",
  component: ResetPassword,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      token: (search.token as string) || undefined,
    };
  },
});

/* =====================================================
   CLIENT ROUTES — requires role "client"
   ===================================================== */

const clientBeforeLoad = requireAuth(["client"]);

const clientDashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "client-dashboard",
  beforeLoad: clientBeforeLoad,
  component: ClientDashboard,
});

const clientProfileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "client-profile",
  beforeLoad: clientBeforeLoad,
  component: ClientProfile,
});

const clientEditProfileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "client-profile-edit",
  beforeLoad: clientBeforeLoad,
  component: ClientEditProfile,
});

export const findLawyerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "FindLawyer",
  beforeLoad: clientBeforeLoad,
  component: FindLawyer,
});

const clientLawyerProfileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "client-lawyer/$lawyerId",
  beforeLoad: clientBeforeLoad,
  component: LawyerProfileView,
});

export const casetrackingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "case-tracking",
  beforeLoad: clientBeforeLoad,
  component: CaseTracking,
});

const clientMessagesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "client-messages",
  beforeLoad: clientBeforeLoad,
  component: ClientMessages,
});

const clientChatDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "client-chat/$threadId",
  beforeLoad: clientBeforeLoad,
  component: ClientChatDetail,
});

const clientHearingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "client-hearings",
  beforeLoad: clientBeforeLoad,
  component: ClientHearings,
});

const clientSignatureViewerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "client-signatures/$requestId",
  beforeLoad: clientBeforeLoad,
  component: ClientSignatureViewer,
});

const clientPaymentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "client-payments",
  beforeLoad: clientBeforeLoad,
  component: ClientCasePayments,
});

const clientPaymentsDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "client-payments/$caseId",
  beforeLoad: clientBeforeLoad,
  component: ClientCasePayments,
});

const clientMyCasesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "client-my-cases",
  beforeLoad: clientBeforeLoad,
  component: ClientMyCases,
});

/* =====================================================
   LAWYER ROUTES — requires role "lawyer"
   ===================================================== */

const lawyerBeforeLoad = requireAuth(["lawyer"]);

const lawyerDashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "Lawyer-dashboard",
  beforeLoad: lawyerBeforeLoad,
  component: LawyerDashboard,
});

const lawyerCasesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "lawyer-cases",
  beforeLoad: lawyerBeforeLoad,
  component: LawyerCases,
});

const lawyerCreateCaseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "lawyer-create-case",
  beforeLoad: lawyerBeforeLoad,
  component: CreateCase,
});

const lawyerNewCaseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "lawyer-new-case",
  beforeLoad: lawyerBeforeLoad,
  component: LawyerNewCase,
});

const lawyerReturnedCasesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "lawyer-returned-cases",
  beforeLoad: lawyerBeforeLoad,
  component: ReturnedCases,
});

const lawyerReturnedCaseDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "lawyer-case-detail/$caseId",
  beforeLoad: lawyerBeforeLoad,
  component: ReturnedCaseDetail,
});

const lawyerHearingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "lawyer-hearings",
  beforeLoad: lawyerBeforeLoad,
  component: LawyerHearings,
});

const lawyerMessagesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "lawyer-messages",
  beforeLoad: lawyerBeforeLoad,
  component: LawyerMessages,
});

const lawyerChatDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "lawyer-chat/$threadId",
  beforeLoad: lawyerBeforeLoad,
  component: ChatDetail,
});

const lawyerSignaturesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "lawyer-signatures",
  beforeLoad: lawyerBeforeLoad,
  component: Signatures,
});

const lawyerSignatureViewerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "lawyer-signatures/$requestId",
  beforeLoad: lawyerBeforeLoad,
  component: LawyerSignatureViewer,
});

const lawyerAiGuidanceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "lawyer-ai-guidance",
  beforeLoad: lawyerBeforeLoad,
  component: AiLegalGuidance,
});

const serviceChargesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "lawyer-service-charges",
  beforeLoad: lawyerBeforeLoad,
  component: ServiceCharges,
});

const lawyerProfileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "lawyer-profile",
  beforeLoad: lawyerBeforeLoad,
  component: LawyerProfile,
});

const lawyerProfileEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "lawyer-profile/edit",
  beforeLoad: lawyerBeforeLoad,
  component: LawyerProfileEdit,
});

const caseDocumentEditorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "lawyer-case-editor",
  beforeLoad: lawyerBeforeLoad,
  component: CaseDocumentEditor,
});

const caseDocumentEditorDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "lawyer-case-editor/$caseId",
  beforeLoad: lawyerBeforeLoad,
  component: CaseDocumentEditor,
});

const lawyerCasePaymentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "lawyer-case-payments",
  beforeLoad: lawyerBeforeLoad,
  component: CasePaymentPlan,
});

const lawyerCasePaymentsDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "lawyer-case-payments/$caseId",
  beforeLoad: lawyerBeforeLoad,
  component: CasePaymentPlan,
});

const lawyerSubmitCaseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "lawyer-submit-case",
  beforeLoad: lawyerBeforeLoad,
  component: SubmitCase,
});

const lawyerSubmitCaseDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "lawyer-submit-case/$caseId",
  beforeLoad: lawyerBeforeLoad,
  component: SubmitCase,
});

/* =====================================================
   REGISTRAR ROUTES — requires role "registrar"
   ===================================================== */

const registrarBeforeLoad = requireAuth(["registrar"]);

const viewCasesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "view-cases",
  beforeLoad: registrarBeforeLoad,
  component: ViewCases,
});

const registrarDashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "registrar-dashboard",
  beforeLoad: registrarBeforeLoad,
  component: RegistrarDashboard,
});

const reviewCasesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "review-cases/$caseId",
  beforeLoad: registrarBeforeLoad,
  component: ReviewCases,
});

const approvedCasesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "approved-cases",
  beforeLoad: registrarBeforeLoad,
  component: ApprovedCases,
});

const returnCaseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "return-case",
  beforeLoad: registrarBeforeLoad,
  component: ReturnCase,
});

const scheduleHearingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "schedule-hearing/$caseId",
  beforeLoad: registrarBeforeLoad,
  component: ScheduleHearing,
});

/* =====================================================
   ADMIN ROUTES — requires role "admin"
   ===================================================== */

const adminBeforeLoad = requireAuth(["admin"]);

const adminDashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "admin-dashboard",
  beforeLoad: adminBeforeLoad,
  component: AdminDashboardPage,
});

const adminRegistrarsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "admin-registrars",
  beforeLoad: adminBeforeLoad,
  component: AdminRegistrarsPage,
});

const adminCreateRegistrarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "admin-registrars/create",
  beforeLoad: adminBeforeLoad,
  component: CreateRegistrar,
});

const adminEditRegistrarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "admin-registrars/edit/$id",
  beforeLoad: adminBeforeLoad,
  component: EditRegistrar,
});

const adminStatisticsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "admin-statistics",
  beforeLoad: adminBeforeLoad,
  component: AdminStatisticPage,
});

const adminTemplatesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "admin-templates",
  beforeLoad: adminBeforeLoad,
  component: AdminTemplatesPage,
});

const adminVerificationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "admin-verifications",
  beforeLoad: adminBeforeLoad,
  component: AdminVerificationsPage,
});

const adminRejectionHistoryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "admin-rejection-history",
  beforeLoad: adminBeforeLoad,
  component: AdminRejectionHistoryPage,
});

const adminProfileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "admin-profile",
  beforeLoad: adminBeforeLoad,
  component: AdminProfilePage,
});

const adminNotificationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "admin-notifications",
  beforeLoad: adminBeforeLoad,
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
  verifyEmailRoute,
  authCallbackRoute,
  resetPasswordRoute,

  // Client Routes
  clientDashboardRoute,
  clientProfileRoute,
  clientEditProfileRoute,
  clientMessagesRoute,
  clientChatDetailRoute,
  clientHearingsRoute,
  clientSignatureViewerRoute,
  clientPaymentsRoute,
  clientPaymentsDetailRoute,
  clientMyCasesRoute,
  findLawyerRoute,
  clientLawyerProfileRoute,
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
  lawyerCasePaymentsRoute,
  lawyerCasePaymentsDetailRoute,
  lawyerSubmitCaseRoute,
  lawyerSubmitCaseDetailRoute,
  lawyerHearingsRoute,
  lawyerMessagesRoute,
  lawyerChatDetailRoute,
  lawyerSignaturesRoute,
  lawyerSignatureViewerRoute,
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
  adminTemplatesRoute,
  adminVerificationsRoute,
  adminRejectionHistoryRoute,
  adminProfileRoute,
  adminNotificationsRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
