import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from "@tanstack/react-router";

import { requireAdmin } from "./routeGuards";
import { getStoredAuthUser } from "../modules/auth/utils/authStorage";

import Login from "../modules/auth/pages/Login";
import ForgotPassword from "../modules/auth/pages/ForgotPassword";
import ResetPassword from "../modules/auth/pages/ResetPassword";
import AdminLayout from "../modules/admin/components/AdminLayout";
import AdminDashboardPage from "../modules/admin/pages/Dashboard";
import AdminRegistrarsPage from "../modules/admin/pages/Registrars";
import CreateRegistrar from "../modules/admin/pages/CreateRegistrar";
import AdminStatisticPage from "../modules/admin/pages/Reports";
import AdminTemplatesPage from "../modules/admin/pages/Templates";
import AdminVerificationsPage from "../modules/admin/pages/Verifications";
import AdminRejectionHistoryPage from "../modules/admin/pages/RejectionHistory";
import AdminCasesPage from "../modules/admin/pages/Cases";
import AdminCaseDetailPage from "../modules/admin/pages/CaseDetail";
import AdminPayoutsPage from "../modules/admin/pages/Payouts";
import AdminFinancesPage from "../modules/admin/pages/Finances";
import AdminProfilePage from "../modules/admin/pages/Profile";
import AdminNotificationsPage from "../modules/admin/pages/Notifications";

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

// Land page: if already authed as admin, go to dashboard; otherwise login.
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    const user = getStoredAuthUser();
    if (user && user.role === "admin") {
      throw redirect({ to: "/dashboard" });
    }
    throw redirect({ to: "/login" });
  },
  component: () => null,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "login",
  component: Login,
});

// Public recovery routes — sit alongside login (NOT under the gated _admin
// layout) so a logged-out admin can reach them. The reset link the backend
// emails to admins lands on /reset-password?token=... in this panel.
const forgotPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "forgot-password",
  component: ForgotPassword,
});

const resetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "reset-password",
  component: ResetPassword,
  // Surface the ?token= query param to the page via useSearch.
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
});

// Pathless layout route: renders the persistent sidebar + top bar via
// AdminLayout's <Outlet />, and gates every admin page behind requireAdmin().
// Adding a new admin page = add a child route here; the layout chrome stays
// owned in exactly one place.
const adminLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  // Underscore prefix is TanStack's convention for pathless layout routes —
  // signals "not a URL segment" at a glance, and the prefix is the only
  // part that leaks into typed `from` strings (e.g. "/_admin/registrars").
  id: "_admin",
  beforeLoad: requireAdmin(),
  component: AdminLayout,
});

const dashboardRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "dashboard",
  component: AdminDashboardPage,
});

const registrarsRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "registrars",
  component: AdminRegistrarsPage,
});

const createRegistrarRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "registrars/create",
  component: CreateRegistrar,
});

const statisticsRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "statistics",
  component: AdminStatisticPage,
});

const templatesRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "templates",
  component: AdminTemplatesPage,
});

const verificationsRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "verifications",
  component: AdminVerificationsPage,
});

const rejectionHistoryRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "rejection-history",
  component: AdminRejectionHistoryPage,
});

const casesRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "cases",
  component: AdminCasesPage,
});

const caseDetailRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "cases/$caseId",
  component: AdminCaseDetailPage,
});

const payoutsRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "payouts",
  component: AdminPayoutsPage,
});

const financesRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "finances",
  component: AdminFinancesPage,
});

const profileRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "profile",
  component: AdminProfilePage,
});

const notificationsRoute = createRoute({
  getParentRoute: () => adminLayoutRoute,
  path: "notifications",
  component: AdminNotificationsPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  forgotPasswordRoute,
  resetPasswordRoute,
  adminLayoutRoute.addChildren([
    dashboardRoute,
    registrarsRoute,
    createRegistrarRoute,
    statisticsRoute,
    templatesRoute,
    verificationsRoute,
    rejectionHistoryRoute,
    casesRoute,
    caseDetailRoute,
    payoutsRoute,
    financesRoute,
    profileRoute,
    notificationsRoute,
  ]),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
