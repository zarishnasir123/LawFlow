import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { RegistrarRole } from "../store/registrars.store";

export type RegistrarFormValues = {
  name: string;
  email: string;
  phone: string;
  cnic: string;
  role: RegistrarRole;
  password?: string;
  confirmPassword?: string;
};

type RegistrarFormProps = {
  title: string;
  subtitle?: string;
  initialValues?: Partial<RegistrarFormValues>;
  showPasswordFields?: boolean;
  submitText: string;
  onCancel: () => void;
  onSubmit: (values: RegistrarFormValues) => void;
};

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
      password: "",
      confirmPassword: "",
    }),
    [initialValues],
  );

  const [values, setValues] = useState<RegistrarFormValues>(defaults);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    setValues(defaults);
  }, [defaults]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!values.name.trim()) return setError("Name is required.");
    if (!values.email.trim()) return setError("Email is required.");
    if (!values.phone.trim()) return setError("Phone is required.");
    if (!values.cnic.trim()) return setError("CNIC is required.");

    if (showPasswordFields) {
      if (!values.password) return setError("Password is required.");
      if (values.password.length < 8) {
        return setError("Password must be at least 8 characters.");
      }
      if (values.password !== values.confirmPassword) {
        return setError("Passwords do not match.");
      }
    }

    onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="rounded-xl border border-green-100 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-[#01411C]">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-gray-600">{subtitle}</p> : null}
      </section>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        Registrar accounts are created by admin only. After account creation, credentials are sent to the registrar email automatically.
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <h2 className="text-base font-semibold text-gray-900 mb-5">
          Registrar Account Details
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
              <input
                readOnly
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#01411C]"
                value={values.role}
              />
            </div>
          </div>

          {showPasswordFields ? (
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Temporary Password *</label>
                <input
                  type="password"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#01411C]"
                  value={values.password ?? ""}
                  onChange={(e) =>
                    setValues({ ...values, password: e.target.value })
                  }
                  placeholder="Create temporary password"
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
      </section>

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
  );
}
