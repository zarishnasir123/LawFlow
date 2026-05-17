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
import AdminDashboardPage from "../modules/admin/pages/Dashboard";
import AdminRegistrarsPage from "../modules/admin/pages/Registrars";
import CreateRegistrar from "../modules/admin/pages/CreateRegistrar";
import EditRegistrar from "../modules/admin/pages/EditRegistrar";
import AdminStatisticPage from "../modules/admin/pages/Reports";
import AdminTemplatesPage from "../modules/admin/pages/Templates";
import AdminVerificationsPage from "../modules/admin/pages/Verifications";
import AdminRejectionHistoryPage from "../modules/admin/pages/RejectionHistory";
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

const adminBeforeLoad = requireAdmin();

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "dashboard",
  beforeLoad: adminBeforeLoad,
  component: AdminDashboardPage,
});

const registrarsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "registrars",
  beforeLoad: adminBeforeLoad,
  component: AdminRegistrarsPage,
});

const createRegistrarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "registrars/create",
  beforeLoad: adminBeforeLoad,
  component: CreateRegistrar,
});

const editRegistrarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "registrars/edit/$id",
  beforeLoad: adminBeforeLoad,
  component: EditRegistrar,
});

const statisticsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "statistics",
  beforeLoad: adminBeforeLoad,
  component: AdminStatisticPage,
});

const templatesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "templates",
  beforeLoad: adminBeforeLoad,
  component: AdminTemplatesPage,
});

const verificationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "verifications",
  beforeLoad: adminBeforeLoad,
  component: AdminVerificationsPage,
});

const rejectionHistoryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "rejection-history",
  beforeLoad: adminBeforeLoad,
  component: AdminRejectionHistoryPage,
});

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "profile",
  beforeLoad: adminBeforeLoad,
  component: AdminProfilePage,
});

const notificationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "notifications",
  beforeLoad: adminBeforeLoad,
  component: AdminNotificationsPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  dashboardRoute,
  registrarsRoute,
  createRegistrarRoute,
  editRegistrarRoute,
  statisticsRoute,
  templatesRoute,
  verificationsRoute,
  rejectionHistoryRoute,
  profileRoute,
  notificationsRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
