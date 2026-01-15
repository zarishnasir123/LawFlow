import { useEffect, useMemo, useState, type FormEvent } from "react";

export type RegistrarFormValues = {
  name: string;
  email: string;
  phone: string;
  cnic: string;
  role: string;
  permissions: string[];
  password?: string;
  confirmPassword?: string;
};

type RegistrarFormProps = {
  title: string;
  subtitle?: string;
  initialValues?: Partial<RegistrarFormValues>;
  showPasswordFields?: boolean; // create = true, edit = false
  submitText: string;
  onCancel: () => void;
  onSubmit: (values: RegistrarFormValues) => void;
};

const AVAILABLE_PERMISSIONS = [
  { id: "view_cases", label: "View Cases" },
  { id: "process_cases", label: "Process Cases" },
  { id: "generate_reports", label: "Generate Reports" },
  { id: "manage_documents", label: "Manage Documents" },
  { id: "schedule_hearings", label: "Schedule Hearings" },
  { id: "send_notices", label: "Send Notices" },
];

export default function RegistrarForm({
  title,
  subtitle,
  initialValues,
  showPasswordFields = false,
  submitText,
  onCancel,
  onSubmit,
}: RegistrarFormProps) {
  const defaults = useMemo<RegistrarFormValues>(
    () => ({
      name: initialValues?.name ?? "",
      email: initialValues?.email ?? "",
      phone: initialValues?.phone ?? "",
      cnic: initialValues?.cnic ?? "",
      role: initialValues?.role ?? "Registrar",
      permissions: initialValues?.permissions ?? [],
      password: "",
      confirmPassword: "",
    }),
    [initialValues]
  );

  const [values, setValues] = useState<RegistrarFormValues>(defaults);
  const [error, setError] = useState<string>("");

  // ✅ sync when initialValues change (useful for edit page)
  useEffect(() => {
    setValues(defaults);
  }, [defaults]);

  const togglePermission = (permId: string) => {
    setValues((prev) => {
      const has = prev.permissions.includes(permId);
      return {
        ...prev,
        permissions: has
          ? prev.permissions.filter((p) => p !== permId)
          : [...prev.permissions, permId],
      };
    });
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!values.name.trim()) return setError("Name is required.");
    if (!values.email.trim()) return setError("Email is required.");
    if (!values.phone.trim()) return setError("Phone is required.");
    if (!values.cnic.trim()) return setError("CNIC is required.");

    if (showPasswordFields) {
      if (!values.password) return setError("Password is required.");
      if (values.password !== values.confirmPassword) {
        return setError("Passwords do not match.");
      }
    }

    onSubmit(values);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#01411C] text-white py-4 px-6 shadow-md">
        <div className="container mx-auto">
          <h1 className="text-lg font-semibold">{title}</h1>
          {subtitle ? (
            <p className="text-sm text-green-100 mt-1">{subtitle}</p>
          ) : null}
        </div>
      </div>

      <div className="container mx-auto px-6 py-8 max-w-4xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <h2 className="text-base font-semibold text-gray-900 mb-5">
              Personal Information
            </h2>

            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium">Full Name *</label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#01411C]"
                  value={values.name}
                  onChange={(e) => setValues({ ...values, name: e.target.value })}
                  placeholder="Muhammad Asif"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email Address *</label>
                  <input
                    type="email"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#01411C]"
                    value={values.email}
                    onChange={(e) => setValues({ ...values, email: e.target.value })}
                    placeholder="asif.registrar@lawflow.pk"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Phone Number *</label>
                  <input
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#01411C]"
                    value={values.phone}
                    onChange={(e) => setValues({ ...values, phone: e.target.value })}
                    placeholder="+92 300 1234567"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">CNIC Number *</label>
                  <input
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#01411C]"
                    value={values.cnic}
                    onChange={(e) => setValues({ ...values, cnic: e.target.value })}
                    placeholder="12345-1234567-1"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Role *</label>
                  <select
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#01411C]"
                    value={values.role}
                    onChange={(e) => setValues({ ...values, role: e.target.value })}
                  >
                    <option value="Registrar">Registrar</option>
                    <option value="Senior Registrar">Senior Registrar</option>
                    <option value="Assistant Registrar">Assistant Registrar</option>
                  </select>
                </div>
              </div>

              {showPasswordFields ? (
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Password *</label>
                    <input
                      type="password"
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#01411C]"
                      value={values.password ?? ""}
                      onChange={(e) => setValues({ ...values, password: e.target.value })}
                      placeholder="Create a strong password"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Confirm Password *</label>
                    <input
                      type="password"
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#01411C]"
                      value={values.confirmPassword ?? ""}
                      onChange={(e) =>
                        setValues({ ...values, confirmPassword: e.target.value })
                      }
                      placeholder="Re-enter password"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <h2 className="text-base font-semibold text-gray-900 mb-2">
              Access Permissions
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Select permissions to grant this registrar
            </p>

            <div className="space-y-3">
              {AVAILABLE_PERMISSIONS.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={values.permissions.includes(p.id)}
                    onChange={() => togglePermission(p.id)}
                  />
                  <span className="text-sm text-gray-900">{p.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="flex-1 rounded-xl bg-[#01411C] px-4 py-3 text-sm font-semibold text-white hover:bg-[#024a23]"
            >
              {submitText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
