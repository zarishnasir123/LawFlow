import { 
  FileText, Clock, CheckCircle, Calendar, Bell, 
  LogOut, Search, Eye, AlertCircle 
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from "@tanstack/react-router";

interface CaseItem {
  id: string;
  title: string;
  type: string;
  subtype: string;
  lawyer: string;
  client: string;
  submittedDate: string;
  submittedTime: string;
  status: 'pending' | 'under-review' | 'approved' | 'returned';
  documents: number;
  urgent: boolean;
}

interface RegistrarDashboardProps {
  logout: () => void;
}

export function RegistrarDashboard({ logout }: RegistrarDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all'); 
    const routerNavigate = useNavigate();
  
  const stats = [
    { title: 'Pending Review', value: '28', icon: Clock, color: 'bg-amber-500', change: '+5 today' },
    { title: 'Processed Today', value: '15', icon: CheckCircle, color: 'bg-emerald-600', change: '60% approved' },
    { title: 'Total Cases', value: '342', icon: FileText, color: 'bg-blue-600', change: 'This month' },
    { title: 'Hearings This Week', value: '12', icon: Calendar, color: 'bg-purple-600', change: '3 tomorrow' },
  ];

  const pendingCases: CaseItem[] = [
    { id: 'LC-2024-0245', title: 'Residential Property Dispute', type: 'Civil', subtype: 'Property Dispute', lawyer: 'Adv. Fatima Ali', client: 'Ahmed Khan', submittedDate: '2025-01-12', submittedTime: '09:30 AM', status: 'pending', documents: 12, urgent: false },
    { id: 'LC-2024-0246', title: 'Family Rights and Inheritance Case', type: 'Family', subtype: 'Inheritance', lawyer: 'Adv. Muhammad Asif', client: 'Sara Ahmed', submittedDate: '2025-01-12', submittedTime: '10:15 AM', status: 'pending', documents: 8, urgent: true },
    { id: 'LC-2024-0247', title: 'Contract Breach and Violation', type: 'Civil', subtype: 'Contract Dispute', lawyer: 'Adv. Ali Hassan', client: 'Usman Malik', submittedDate: '2025-01-11', submittedTime: '02:45 PM', status: 'pending', documents: 15, urgent: false },
    { id: 'LC-2024-0248', title: 'Divorce Petition Filing', type: 'Family', subtype: 'Divorce', lawyer: 'Adv. Ayesha Khan', client: 'Bilal Ahmed', submittedDate: '2025-01-11', submittedTime: '04:20 PM', status: 'under-review', documents: 10, urgent: false },
  ];

  const filteredCases = pendingCases.filter((item) => {
    const matchesSearch = item.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.lawyer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || item.status === filterStatus;
    const matchesType = filterType === 'all' || item.type.toLowerCase() === filterType.toLowerCase();
    return matchesSearch && matchesStatus && matchesType;
  });

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <header className="bg-[#01411C] text-white sticky top-0 z-50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <FileText className="h-5 sm:h-6 w-5 sm:w-6 text-white" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold leading-none uppercase tracking-wider">LawFlow</h1>
              <span className="text-[9px] sm:text-[10px] text-green-200 uppercase tracking-widest">Registrar Portal</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-white/10 rounded-full relative transition-colors">
              <Bell className="h-4 sm:h-5 w-4 sm:w-5" />
              <span className="absolute top-1 right-1 bg-red-500 border-2 border-[#01411C] w-3 h-3 rounded-full" />
            </button>
            <div className="h-8 w-[1px] bg-white/20 mx-2" />
            <button onClick={logout} className="flex items-center gap-2 px-3 py-2 hover:bg-white/10 rounded-lg transition-colors text-xs sm:text-sm font-medium">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="lg:col-span-4 flex flex-col sm:flex-row items-start sm:items-end justify-between border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">Dashboard Overview</h2>
              <p className="text-sm sm:text-base text-slate-500">Welcome back, Registrar Muhammad Iqbal</p>
            </div>
            <div className="text-right hidden md:block">
              <p className="text-xs sm:text-sm font-medium text-slate-400 uppercase tracking-tighter">Current Date</p>
              <p className="text-base sm:text-lg font-semibold text-slate-700">January 13, 2026</p>
            </div>
          </div>

          {stats.map((stat, i) => (
            <div key={i} className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div className={`${stat.color} p-2.5 rounded-xl shadow-lg shadow-current/10`}>
                  <stat.icon className="h-4 sm:h-5 w-4 sm:w-5 text-white" />
                </div>
                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-full uppercase tracking-widest">
                  {stat.change}
                </span>
              </div>
              <div className="mt-4">
                <p className="text-3xl font-black text-slate-800 tracking-tight">{stat.value}</p>
                <p className="text-sm font-medium text-slate-500">{stat.title}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#01411C] focus:border-transparent outline-none transition-all text-sm"
              placeholder="Search by case ID, lawyer name, or client..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <select 
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#01411C]"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending Review</option>
            <option value="under-review">Under Review</option>
          </select>

          <select 
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#01411C]"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">All Case Types</option>
            <option value="civil">Civil Cases</option>
            <option value="family">Family Cases</option>
          </select>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Case Information</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Parties</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Submission</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCases.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-slate-900">{item.id}</span>
                          {item.urgent && (
                            <span className="flex items-center gap-1 text-[10px] font-black uppercase bg-red-100 text-red-600 px-2 py-0.5 rounded-md animate-pulse">
                              <AlertCircle className="h-3 w-3" /> Urgent
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-medium text-slate-700 leading-relaxed mb-1">
                          {item.title}
                        </span>
                        <div className="flex gap-2">
                          <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded uppercase tracking-tighter border border-blue-100">
                            {item.type}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="text-sm">
                        <p className="font-semibold text-slate-800">{item.lawyer}</p>
                        <p className="text-slate-500 text-xs">Lawyer</p>
                        <p className="mt-2 font-semibold text-slate-800">{item.client}</p>
                        <p className="text-slate-500 text-xs">Client</p>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-sm">
                      <p className="font-medium text-slate-700">{item.submittedDate}</p>
                      <p className="text-slate-400 text-xs">{item.submittedTime}</p>
                      <div className="mt-2 flex items-center gap-1 text-slate-500 text-xs italic">
                        <FileText className="h-3 w-3" /> {item.documents} attachments
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <button 
                        onClick={() => routerNavigate({ to: '/view-cases' })}
                        className="w-full flex items-center justify-center gap-2 bg-[#01411C] hover:bg-[#025a27] text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-md active:scale-95"
                      >
                        <Eye className="h-4 w-4" /> View Cases
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}