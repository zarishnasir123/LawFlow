// import { useNavigate } from "@tanstack/react-router";
// import {
//   Users,
//   UserCheck,
//   Clock,
//   CheckCircle,
//   Bell,
//   User,
//   LogOut,
//   Shield,
//   Activity,
// } from "lucide-react";

// import DashboardLayout from "../../../shared/components/dashboard/DashboardLayout";
// import StatCard from "../../../shared/components/dashboard/StatCard";
// import RecentActivity from "../../../shared/components/dashboard/RecentActivity";
// import type {
//   DashboardStat,
//   ActivityItem,
// } from "../../../shared/types/dashboard";

// export default function AdminDashboard() {
//   const navigate = useNavigate();

//   const stats: DashboardStat[] = [
//     {
//       label: "Pending Verifications",
//       value: "12",
//       icon: Clock,
//       accentClassName: "bg-yellow-500",
//     },
//     {
//       label: "Active Registrars",
//       value: "8",
//       icon: UserCheck,
//       accentClassName: "bg-green-500",
//     },
//     {
//       label: "Total Users",
//       value: "1,248",
//       icon: Users,
//       accentClassName: "bg-blue-500",
//     },
//     {
//       label: "Verified Today",
//       value: "23",
//       icon: CheckCircle,
//       accentClassName: "bg-purple-500",
//     },
//   ];

//   const activityItems: ActivityItem[] = [
//     {
//       id: 1,
//       label: "Lawyer verification approved (Adv. Fatima Ali)",
//       time: "5 minutes ago",
//       type: "case",
//     },
//     {
//       id: 2,
//       label: "New registrar account created",
//       time: "1 hour ago",
//       type: "case",
//     },
//     {
//       id: 3,
//       label: "Client verification approved",
//       time: "2 hours ago",
//       type: "case",
//     },
//     {
//       id: 4,
//       label: "Registrar processed 5 case files",
//       time: "3 hours ago",
//       type: "case",
//     },
//   ];

//   return (
//     <DashboardLayout
//       brandTitle="LawFlow"
//       brandSubtitle="Admin Portal"
//       actions={[
//         {
//           label: "Notifications",
//           icon: Bell,
//           onClick: () => navigate({ to: "/admin-notifications" }),
//           badge: 3,
//         },
//         {
//           label: "Profile",
//           icon: User,
//           onClick: () => navigate({ to: "/admin-profile" }),
//         },
//         {
//           label: "Logout",
//           icon: LogOut,
//           onClick: () => navigate({ to: "/login" }),
//         },
//       ]}
//     >
//       {/* Welcome */}
//       <div className="mb-6 flex items-center justify-between">
//         <div>
//           <h2 className="text-xl font-semibold text-gray-900">
//             Welcome back, Admin
//           </h2>
//           <p className="text-sm text-gray-600">
//             Monitor system activity and manage users efficiently.
//           </p>
//         </div>
//         <Shield className="h-10 w-10 text-[#01411C] opacity-30" />
//       </div>

//       {/* Stats */}
//       <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
//         {stats.map((stat) => (
//           <StatCard key={stat.label} {...stat} />
//         ))}
//       </section>

//       {/* Quick Actions */}
//       <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
//         <button
//           onClick={() => navigate({ to: "/admin-verifications" })}
//           className="rounded-xl border bg-white p-5 text-left hover:shadow-md transition"
//         >
//           <Clock className="mb-2 h-6 w-6 text-yellow-600" />
//           <h3 className="font-semibold text-gray-900">
//             Pending Verifications
//           </h3>
//           <p className="text-sm text-gray-600">
//             Review and approve user registrations
//           </p>
//         </button>

//         <button
//           onClick={() => navigate({ to: "/admin-registrars" })}
//           className="rounded-xl border bg-white p-5 text-left hover:shadow-md transition"
//         >
//           <UserCheck className="mb-2 h-6 w-6 text-blue-600" />
//           <h3 className="font-semibold text-gray-900">
//             Manage Registrars
//           </h3>
//           <p className="text-sm text-gray-600">
//             Create and manage registrar accounts
//           </p>
//         </button>

//         <button
//           onClick={() => navigate({ to: "/admin-reports" })}
//           className="rounded-xl border bg-white p-5 text-left hover:shadow-md transition"
//         >
//           <Activity className="mb-2 h-6 w-6 text-purple-600" />
//           <h3 className="font-semibold text-gray-900">
//             System Reports
//           </h3>
//           <p className="text-sm text-gray-600">
//             View analytics and system activity
//           </p>
//         </button>
//       </section>

//       {/* Recent Activity */}
//       <section className="mt-6">
//         <RecentActivity items={activityItems} />
//       </section>
//     </DashboardLayout>
//   );
// }