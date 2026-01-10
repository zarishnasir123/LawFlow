import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Scale, Gavel, FileText, Shield, CheckCircle, Menu, X } from "lucide-react";

export default function Landing() {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleNavigate = (to: string) => {
    setIsMenuOpen(false);
    navigate({ to });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-green-50">
      {/* Header */}
      <header className="border-b border-green-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="w-full px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-[#01411C] p-2 rounded-lg">
              <Scale className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#01411C]">LawFlow</h1>
              <p className="text-xs text-gray-600">Legal Case Management System</p>
            </div>
          </div>

          <div className="hidden md:flex gap-3">
            <button
              onClick={() => handleNavigate("/login")}
              className="px-5 py-2 rounded-xl border border-[#01411C] text-[#01411C] hover:bg-green-50 transition"
            >
              Login
            </button>
            <button
              onClick={() => handleNavigate("/register")}
              className="px-5 py-2 rounded-xl bg-[#01411C] text-white hover:bg-[#024a23] transition"
            >
              Register
            </button>
          </div>

          <button
            type="button"
            aria-label="Toggle menu"
            onClick={() => setIsMenuOpen((open) => !open)}
            className="md:hidden inline-flex items-center justify-center rounded-lg border border-green-200 p-2 text-[#01411C] hover:bg-green-50 transition"
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {isMenuOpen && (
          <div className="md:hidden border-t border-green-100 bg-white/95 backdrop-blur-sm">
            <div className="w-full px-4 sm:px-6 py-4 flex flex-col gap-3">
              <button
                onClick={() => handleNavigate("/login")}
                className="w-full px-5 py-2 rounded-xl border border-[#01411C] text-[#01411C] hover:bg-green-50 transition"
              >
                Login
              </button>
              <button
                onClick={() => handleNavigate("/register")}
                className="w-full px-5 py-2 rounded-xl bg-[#01411C] text-white hover:bg-[#024a23] transition"
              >
                Register
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:py-16 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-block mb-4 px-4 py-1 bg-green-100 text-[#01411C] rounded-full">
            <span className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Government of Pakistan
            </span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 text-gray-900">
            Digital Legal Case Management
            <span className="text-[#01411C]"> Made Simple</span>
          </h2>

          <p className="text-base sm:text-lg lg:text-xl text-gray-600 mb-8">
            Streamline your legal workflow with Pakistan&apos;s premier case management system.
            Connect clients, lawyers, and court officials seamlessly.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={() => handleNavigate("/register")}
              className="w-full sm:w-auto px-7 py-3 rounded-xl bg-[#01411C] text-white hover:bg-[#024a23] transition"
            >
              Get Started
            </button>
            <button
              onClick={() => handleNavigate("/login")}
              className="w-full sm:w-auto px-7 py-3 rounded-xl border border-[#01411C] text-[#01411C] hover:bg-green-50 transition"
            >
              Sign In
            </button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <h3 className="text-2xl sm:text-3xl font-bold text-center mb-10 sm:mb-12 text-gray-900">
          System Features
        </h3>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">
          {[
            {
              icon: <FileText className="h-8 w-8 text-[#01411C]" />,
              title: "Client Portal",
              desc: "Upload documents, track case status, and communicate with your lawyer in real-time.",
            },
            {
              icon: <Gavel className="h-8 w-8 text-[#01411C]" />,
              title: "Lawyer Tools",
              desc: "AI-powered document templates, case preparation, and client management tools.",
            },
            {
              icon: <Scale className="h-8 w-8 text-[#01411C]" />,
              title: "Registrar System",
              desc: "Review submissions, approve cases, schedule hearings, and manage court workflows.",
            },
            {
              icon: <Shield className="h-8 w-8 text-[#01411C]" />,
              title: "Admin Control",
              desc: "Manage registrars, document templates, and view comprehensive system statistics.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="group p-10 bg-white border border-green-100 rounded-2xl transition-all duration-300
                         hover:-translate-y-1 hover:border-green-200 hover:bg-green-50/60 hover:shadow-xl hover:shadow-green-200/40"
            >
              <div className="bg-green-100 w-16 h-16 rounded-lg flex items-center justify-center mb-4 transition-colors group-hover:bg-green-200">
                {f.icon}
              </div>
              <h4 className="mb-2 font-semibold text-[#01411C]">{f.title}</h4>
              <p className="text-sm text-gray-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Role Selection Cards */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <h3 className="text-2xl sm:text-3xl font-bold text-center mb-10 sm:mb-12 text-gray-900">
          Select Your Role
        </h3>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {[
            { role: "client", icon: <FileText className="h-9 w-9 text-[#01411C]" />, title: "Client", desc: "Access your cases and connect with lawyers" },
            { role: "lawyer", icon: <Gavel className="h-9 w-9 text-[#01411C]" />, title: "Lawyer", desc: "Manage cases and represent clients" },
            { role: "registrar", icon: <Scale className="h-9 w-9 text-[#01411C]" />, title: "Registrar", desc: "Review and approve case submissions" },
            { role: "admin", icon: <Shield className="h-9 w-9 text-[#01411C]" />, title: "Admin", desc: "System administration and oversight" },
          ].map((r) => (
            <button
              key={r.role}
              onClick={() => handleNavigate(`/login?role=${r.role}`)}
              className="group p-10 text-center bg-white rounded-2xl transition-all duration-300 cursor-pointer
                         hover:-translate-y-1 hover:bg-green-50/60 hover:border-green-200 hover:shadow-xl hover:shadow-green-200/40
                         border-2 border-transparent hover:border-[#01411C]"
            >
              <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors group-hover:bg-green-200">
                {r.icon}
              </div>
              <h4 className="mb-2 font-semibold text-[#01411C]">{r.title}</h4>
              <p className="text-sm text-gray-600">{r.desc}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-[#01411C] text-white py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h3 className="text-2xl sm:text-3xl font-bold text-center mb-10 sm:mb-12">
            Why Choose LawFlow?
          </h3>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { title: "Secure & Compliant", desc: "Built following Pakistan government security standards" },
              { title: "Real-time Updates", desc: "Instant notifications for case status and hearings" },
              { title: "Easy to Use", desc: "Intuitive interface designed for all user levels" },
            ].map((b) => (
              <div key={b.title} className="text-center">
                <CheckCircle className="h-12 w-12 mx-auto mb-4" />
                <h4 className="mb-2 font-semibold">{b.title}</h4>
                <p className="text-sm text-green-100">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-green-100 py-8">
        <div className="mx-auto max-w-6xl px-4 text-center text-gray-600">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Scale className="h-5 w-5 text-[#01411C]" />
            <span className="font-bold text-[#01411C]">LawFlow</span>
          </div>
          <p className="text-sm">© 2025 Government of Pakistan. All rights reserved.</p>
          <p className="text-xs mt-2">Legal Case Management System</p>
        </div>
      </footer>
    </div>
  );
}
