import React from 'react';
import { 
  Users, UserCheck, Activity, Bell, User, 
  LogOut, Shield, Clock, CheckCircle 
} from 'lucide-react';

// Reusable UI Components (Inhein aap alag files mein bhi rakh sakti hain)
const StatCard = ({ title, value, icon: Icon, color, change }: any) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 transition-hover hover:shadow-md">
    <div className="flex items-center justify-between mb-4">
      <div className={`${color} p-3 rounded-lg text-white`}>
        <Icon size={24} />
      </div>
    </div>
    <h3 className="text-2xl font-bold text-gray-900 mb-1">{value}</h3>
    <p className="text-sm text-gray-600 mb-2">{title}</p>
    <p className="text-xs text-gray-400">{change}</p>
  </div>
);

const ActionCard = ({ title, desc, badge, badgeColor, icon: Icon, onClick }: any) => (
  <div 
    onClick={onClick}
    className="bg-white p-6 rounded-xl border border-gray-100 hover:border-green-200 hover:shadow-lg transition-all cursor-pointer group"
  >
    <div className="flex items-center gap-4 mb-4">
      <div className="bg-gray-50 group-hover:bg-green-50 p-3 rounded-lg transition-colors">
        <Icon className="h-6 w-6 text-gray-600 group-hover:text-[#01411C]" />
      </div>
      <h3 className="font-semibold text-gray-900">{title}</h3>
    </div>
    <p className="text-sm text-gray-500 mb-4">{desc}</p>
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${badgeColor}`}>
      {badge}
    </span>
  </div>
);

interface AdminDashboardProps {
  navigate: (page: string, data?: any) => void;
  logout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ navigate, logout }) => {
  
  // Data Arrays (Inhein kal ko hum API se fetch karenge)
  const stats = [
    { title: 'Pending Verifications', value: '12', icon: Clock, color: 'bg-amber-500', change: '+3 today' },
    { title: 'Active Registrars', value: '8', icon: UserCheck, color: 'bg-emerald-500', change: '2 online' },
    { title: 'Total Users', value: '1,248', icon: Users, color: 'bg-blue-500', change: '+45 this week' },
    { title: 'Verified Today', value: '23', icon: CheckCircle, color: 'bg-purple-500', change: '18 approved' },
  ];

  return (
    <div className="min-h-screen bg-gray-50/50 font-sans">
      {/* Optimized Header */}
      <header className="bg-[#01411C] text-white sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/10 p-2 rounded-lg">
                <Shield className="h-6 w-6 text-green-200" />
              </div>
              <div>
                <h1 className="text-lg font-bold leading-none">LawFlow</h1>
                <p className="text-[10px] text-green-200 uppercase tracking-widest mt-1">Admin Control Panel</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button onClick={() => navigate('notifications')} className="p-2 hover:bg-white/10 rounded-full relative transition-colors">
                <Bell size={20} />
                <span className="absolute top-1 right-1 bg-red-500 border-2 border-[#01411C] rounded-full w-3 h-3"></span>
              </button>
              <button onClick={() => navigate('profile')} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <User size={20} />
              </button>
              <div className="h-6 w-[1px] bg-white/20 mx-2"></div>
              <button onClick={logout} className="flex items-center gap-2 px-3 py-1.5 hover:bg-red-500/20 rounded-lg text-red-200 transition-all">
                <LogOut size={18} />
                <span className="text-sm font-medium">Exit</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Dashboard Overview</h2>
          <p className="text-gray-500">Welcome back! Here is what's happening with the system today.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {stats.map((s, i) => <StatCard key={i} {...s} />)}
        </div>

        {/* Quick Actions - Grid layout optimized */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <ActionCard 
            title="User Verifications"
            desc="Review pending lawyer and client KYC documents."
            badge="12 Pending"
            badgeColor="bg-amber-100 text-amber-700"
            icon={Clock}
            onClick={() => navigate('pending-verifications')}
          />
          <ActionCard 
            title="Registrar Management"
            desc="Add new registrars or manage existing court staff."
            badge="8 Active"
            badgeColor="bg-emerald-100 text-emerald-700"
            icon={UserCheck}
            onClick={() => navigate('manage-registrars')}
          />
          <ActionCard 
            title="System Analytics"
            desc="Generate reports for case filings and user growth."
            badge="View Reports"
            badgeColor="bg-purple-100 text-purple-700"
            icon={Activity}
            onClick={() => navigate('reports')}
          />
        </div>

        {/* Recent Activity Table/List Section could go here */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900">Recent System Logs</h3>
                <button className="text-sm font-semibold text-[#01411C] hover:underline">View All logs</button>
            </div>
            <div className="text-center py-10 text-gray-400 italic">
                <Activity className="mx-auto mb-2 opacity-20" size={40} />
                Activity logs will appear here in real-time
            </div>
        </div>
      </main>
    </div>
  );
};