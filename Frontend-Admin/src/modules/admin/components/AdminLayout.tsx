import { useEffect, useState } from "react";
import {
  Link,
  Outlet,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import {
  BadgeCheck,
  BarChart3,
  Bell,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  FileText,
  GitBranch,
  LayoutDashboard,
  LogOut,
  Menu,
  Shield,
  Star,
  UserCheck,
  UserCircle2,
  UserX,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";

import { useAdminNotificationCount } from "../hooks/useAdminNotificationCount";
import { usePendingLawyerCount } from "../hooks/usePendingLawyerCount";
import { useOpenPayoutCount } from "../hooks/useOpenPayoutCount";
import { useLiveNotifications } from "../../../shared/hooks/useLiveNotifications";
import { notificationSocket } from "../../../shared/api/notificationSocket";
import { clearStoredAuth } from "../../auth/utils/authStorage";
import {
  avatarInitial,
  displayFullName,
  useCurrentUser,
} from "../../auth/hooks/useCurrentUser";
import LogoutConfirmationModal from "./modals/LogoutConfirmationModal";

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  /**
   * Extra route paths that should also light up this nav item (e.g. nested
   * routes like /registrars/create should highlight Registrars).
   */
  matchPrefixes?: string[];
};

const navItems: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    to: "/registrars",
    label: "Registrars",
    icon: UserCheck,
    matchPrefixes: ["/registrars"],
  },
  { to: "/verifications", label: "Lawyer Verifications", icon: BadgeCheck },
  { to: "/rejection-history", label: "Rejection History", icon: UserX },
  { to: "/reviews", label: "Reviews", icon: Star },
  {
    to: "/cases",
    label: "Case Tracking",
    icon: GitBranch,
    matchPrefixes: ["/cases"],
  },
  { to: "/payouts", label: "Payouts", icon: Wallet },
  { to: "/finances", label: "Finances", icon: CircleDollarSign },
  { to: "/templates", label: "Templates", icon: FileText },
  { to: "/statistics", label: "Statistics", icon: BarChart3 },
  { to: "/notifications", label: "Notifications", icon: Bell },
  // Profile is reached via the identity chip in the sidebar footer (avatar +
  // name), so it's intentionally not duplicated as a top-level nav item.
];

const SIDEBAR_COLLAPSED_STORAGE_KEY = "lawflow_admin_sidebar_collapsed";

function isItemActive(currentPath: string, item: NavItem) {
  if (currentPath === item.to) return true;
  return (item.matchPrefixes ?? []).some(
    (prefix) => currentPath === prefix || currentPath.startsWith(`${prefix}/`),
  );
}

function readStoredCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "1";
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(readStoredCollapsed);

  // Persist the desktop collapse preference so it survives reloads and route
  // changes. Mobile drawer state is intentionally not persisted — it's a
  // transient overlay, not a layout preference.
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      SIDEBAR_COLLAPSED_STORAGE_KEY,
      collapsed ? "1" : "0",
    );
  }, [collapsed]);

  // Close the mobile drawer the moment the user picks a link. Done at the
  // event source instead of in an effect-on-route-change so we don't trip the
  // set-state-in-effect lint and don't re-render twice per navigation.
  const closeMobileDrawer = () => setMobileOpen(false);

  const unreadCount = useAdminNotificationCount();
  const pendingLawyerCount = usePendingLawyerCount();
  const openPayoutCount = useOpenPayoutCount();
  // Live notifications: refetch the badge + center the instant the backend pushes
  // a new admin notification (payout request / lawyer awaiting verification).
  useLiveNotifications();
  const { data: currentUser } = useCurrentUser();
  const profileActive = location.pathname === "/profile";

  const handleLogout = () => {
    // Clear only auth state (user + in-memory token) — never localStorage.clear(),
    // which would also wipe unrelated preferences like the sidebar collapse state.
    clearStoredAuth();
    // Close the live socket so it isn't left authed as this admin for whoever
    // logs in next on the same tab (no full reload happens here).
    notificationSocket.disconnect();
    setLogoutOpen(false);
    navigate({ to: "/login" });
  };

  // Mobile overlays always render full-width regardless of the persisted
  // desktop collapse preference — a 72px drawer on a phone is unreadable.
  const showLabels = !collapsed || mobileOpen;

  return (
    <>
      <LogoutConfirmationModal
        open={logoutOpen}
        onCancel={() => setLogoutOpen(false)}
        onConfirm={handleLogout}
      />

      <div className="min-h-screen bg-gray-50">
        {/* Mobile backdrop. Click anywhere to dismiss the sidebar. */}
        {mobileOpen ? (
          <div
            className="fixed inset-0 z-30 bg-black/40 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
        ) : null}

        <aside
          className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-[#01411C] text-white shadow-xl transition-[width,transform] duration-200 ease-out lg:translate-x-0 ${
            mobileOpen ? "w-64 translate-x-0" : `${collapsed ? "lg:w-[72px]" : "lg:w-64"} w-64 -translate-x-full`
          }`}
        >
          <div
            className={`flex items-center gap-3 border-b border-white/10 ${
              showLabels ? "h-[72px] justify-between px-4" : "h-[72px] justify-center px-2"
            }`}
          >
            <div className={`flex items-center ${showLabels ? "gap-3" : "gap-0"}`}>
              <div className="rounded-lg bg-white/10 p-2">
                <Shield className="h-6 w-6" />
              </div>
              {showLabels ? (
                <div className="leading-tight">
                  <div className="text-base font-semibold">LawFlow</div>
                  <div className="text-xs text-green-100/80">Admin Portal</div>
                </div>
              ) : null}
            </div>

            {/* Mobile-only close button. Desktop collapse/expand lives on the
                right edge of the sidebar (see absolutely-positioned button
                below) to match the Notion/Linear admin pattern. */}
            {mobileOpen ? (
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-1.5 text-white/80 hover:bg-white/10 lg:hidden"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            ) : null}
          </div>

          {/* Edge-mounted collapse/expand toggle: a circular pill that hugs
              the right edge of the sidebar, half-overlapping the main content
              area. Desktop-only — mobile uses the in-header X above. */}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="absolute top-[60px] -right-3 z-50 hidden h-6 w-6 items-center justify-center rounded-full bg-white text-gray-900 shadow-md ring-2 ring-gray-900 hover:bg-gray-50 lg:flex"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronLeft className="h-3.5 w-3.5" />
            )}
          </button>

          <nav
            className={`flex-1 overflow-y-auto py-4 ${
              showLabels ? "px-3" : "px-2"
            }`}
          >
            <ul className="space-y-1">
              {navItems.map((item) => {
                const active = isItemActive(location.pathname, item);
                const Icon = item.icon;
                // Three badges share the sidebar: unread notifications (red),
                // pending lawyer verifications (amber), and payouts awaiting
                // action (blue). All follow the same dot-on-collapsed /
                // number-on-expanded pattern.
                const badgeCount = (() => {
                  if (item.to === "/notifications") return unreadCount;
                  if (item.to === "/verifications") return pendingLawyerCount;
                  if (item.to === "/payouts") return openPayoutCount;
                  return 0;
                })();
                const badgeColorClass =
                  item.to === "/verifications"
                    ? "bg-amber-500"
                    : item.to === "/payouts"
                      ? "bg-blue-500"
                      : "bg-red-500";
                const showBadge = badgeCount > 0;
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={closeMobileDrawer}
                      title={showLabels ? undefined : item.label}
                      className={`group relative flex items-center rounded-lg text-sm font-medium transition-colors ${
                        showLabels
                          ? "justify-between gap-3 px-3 py-2.5"
                          : "justify-center px-2 py-2.5"
                      } ${
                        active
                          ? "bg-white/15 text-white"
                          : "text-green-100/85 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <span
                        className={`flex items-center ${
                          showLabels ? "gap-3" : "gap-0"
                        }`}
                      >
                        <Icon className="h-[18px] w-[18px] shrink-0" />
                        {showLabels ? <span>{item.label}</span> : null}
                      </span>
                      {showBadge ? (
                        showLabels ? (
                          <span className={`inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold text-white ${badgeColorClass}`}>
                            {badgeCount}
                          </span>
                        ) : (
                          <span className={`absolute top-1 right-1 inline-flex h-2 w-2 rounded-full ${badgeColorClass}`} />
                        )
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div
            className={`border-t border-white/10 py-4 ${
              showLabels ? "px-3" : "px-2"
            }`}
          >
            {/* Logged-in admin identity — display only. Collapses to just the
                avatar when the sidebar is collapsed. */}
            <div
              className={`flex items-center ${
                showLabels ? "gap-3 px-2 py-2" : "justify-center px-2 py-2"
              }`}
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-white/15 text-sm font-semibold text-white">
                {currentUser?.avatarUrl ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  avatarInitial(currentUser)
                )}
              </span>
              {showLabels ? (
                <span className="min-w-0 leading-tight">
                  <span className="block truncate text-sm font-medium text-white">
                    {displayFullName(currentUser) || "Admin"}
                  </span>
                  <span className="block text-xs text-green-100/70">
                    Administrator
                  </span>
                </span>
              ) : null}
            </div>

            {/* Profile option — the single way into the admin's own profile. */}
            <Link
              to="/profile"
              onClick={closeMobileDrawer}
              title={showLabels ? undefined : "Administrator Profile"}
              className={`mt-1 flex items-center rounded-lg text-sm font-medium transition-colors ${
                showLabels
                  ? "gap-3 px-3 py-2.5"
                  : "justify-center px-2 py-2.5"
              } ${
                profileActive
                  ? "bg-white/15 text-white"
                  : "text-green-100/85 hover:bg-white/10 hover:text-white"
              }`}
            >
              <UserCircle2 className="h-[18px] w-[18px] shrink-0" />
              {showLabels ? <span>Administrator Profile</span> : null}
            </Link>

            <button
              type="button"
              onClick={() => setLogoutOpen(true)}
              title={showLabels ? undefined : "Logout"}
              className={`flex w-full items-center rounded-lg text-sm font-medium text-green-100/85 hover:bg-white/10 hover:text-white ${
                showLabels
                  ? "gap-3 px-3 py-2.5"
                  : "justify-center px-2 py-2.5"
              }`}
            >
              <LogOut className="h-[18px] w-[18px] shrink-0" />
              {showLabels ? "Logout" : null}
            </button>
          </div>
        </aside>

        <div
          className={`transition-[padding] duration-200 ${
            collapsed ? "lg:pl-[72px]" : "lg:pl-64"
          }`}
        >
          {/* Floating menu toggle for mobile only. Desktop users have the
              persistent sidebar, so no top-bar chrome is needed there. */}
          {!mobileOpen ? (
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="fixed top-3 left-3 z-30 flex h-10 w-10 items-center justify-center rounded-lg bg-white text-gray-700 shadow-md ring-1 ring-gray-200 hover:bg-gray-50 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          ) : null}

          <main>
            <Outlet />
          </main>
        </div>
      </div>
    </>
  );
}
