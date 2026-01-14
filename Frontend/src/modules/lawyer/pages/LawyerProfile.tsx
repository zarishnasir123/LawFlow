// import { useNavigate } from "@tanstack/react-router";
// import { ArrowLeft } from "lucide-react";
// import DashboardLayout from "../../../shared/components/dashboard/DashboardLayout";
// import ProfileCard from "../../../shared/components/profile/ProfileCard";
// import ProfileField from "../../../shared/components/profile/ProfileField";

// export default function LawyerProfile() {
//   const navigate = useNavigate();

//   return (
//     <DashboardLayout
//       brandTitle={
//         <div
//           className="flex items-start gap-3 cursor-pointer"
//           onClick={() => navigate({ to: "/lawyer-dashboard" })}
//         >
//           <ArrowLeft className="mt-1 h-5 w-5 text-white" />
//           <div className="flex flex-col">
//             <span className="text-lg font-semibold">My Profile</span>
//             <p className="text-sm text-green-100">
//               View and update your information
//             </p>
//           </div>
//         </div>
//       }
//       roleLabel="Lawyer"
//     >
//       <ProfileCard
//         name="Adv. Fatima Ali"
//         memberSince="March 10, 2023"
//         roleLabel="Lawyer"
//         onEdit={() => navigate({ to: "/lawyer-profile/edit" })}
//       >
//         {/* Lawyer Information Grid */}
//         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//           <ProfileField label="Full Name" value="Adv. Fatima Ali" />
//           <ProfileField label="Email Address" value="fatima.ali@lawfirm.com" />
//           <ProfileField label="Phone Number" value="+92 321 7654321" />
//           <ProfileField label="CNIC Number" value="54321-7654321-9" />
//           <ProfileField label="Bar Council Number" value="ISB-2018-1234" />
//           <ProfileField label="Specialization" value="Civil Law" />
//           <ProfileField label="Years of Experience" value="6 years" />
//           <ProfileField
//             label="Address"
//             value="Office 301, Blue Area, Islamabad"
//           />
//         </div>

//         {/* Account Settings */}
//         <div className="pt-6 border-t">
//           <h3 className="font-semibold text-gray-900 mb-3">
//             Account Settings
//           </h3>

//           <div className="flex flex-wrap gap-3">
//             <button
//               onClick={() => navigate({ to: "/" })}
//               className="border px-4 py-2 rounded-md text-sm hover:bg-gray-50"
//             >
//               Change Password
//             </button>

//             <button
//               onClick={() => navigate({ to: "/" })}
//               className="border px-4 py-2 rounded-md text-sm hover:bg-gray-50"
//             >
//               Notification Preferences
//             </button>

//             <button
//               onClick={() => navigate({ to: "/" })}
//               className="border border-red-500 text-red-600 px-4 py-2 rounded-md text-sm hover:bg-red-50"
//             >
//               Deactivate Account
//             </button>
//           </div>
//         </div>
//       </ProfileCard>
//     </DashboardLayout>
//   );
// }
