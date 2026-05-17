import { useEffect, useMemo, useState, type FormEvent } from "react";

export type RegistrarRole = "Registrar";

export type RegistrarFormValues = {
  name: string;
  email: string;
  phone: string;
  cnic: string;
  role: RegistrarRole;
};

type RegistrarFormProps = {
  title: string;
  subtitle?: string;
  initialValues?: Partial<RegistrarFormValues>;
  /**
   * In edit mode the email and CNIC are read-only because the backend update
   * endpoint does not accept changes to either (changing identity columns
   * after creation would invalidate audit trails and unique constraints).
   */
  editMode?: boolean;
  submitText: string;
  submitting?: boolean;
  onCancel: () => void;
  onSubmit: (values: RegistrarFormValues) => void | Promise<void>;
};

export default function RegistrarForm({
  title,
  subtitle,
  initialValues,
  editMode = false,
  submitText,
  submitting = false,
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
    if (values.name.trim().split(/\s+/).length < 2) {
      return setError("Please enter first name and last name.");
    }
    if (!values.email.trim()) return setError("Email is required.");
    if (!values.phone.trim()) return setError("Phone is required.");
    if (!values.cnic.trim()) return setError("CNIC is required.");

    // No password validation here — the backend generates a temporary
    // password server-side on create and emails it to the registrar.

    onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="rounded-xl border border-green-100 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-[#01411C]">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-gray-600">{subtitle}</p> : null}
      </section>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        {editMode
          ? "Email and CNIC cannot be changed after the account is created. Use the registrar list to deactivate or delete the account if a different identity is needed."
          : "A secure temporary password is generated automatically and emailed to the registrar. They will be required to change it on first login."}
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
              disabled={submitting}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email Address *</label>
              <input
                type="email"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#01411C] disabled:bg-gray-100"
                value={values.email}
                onChange={(e) => setValues({ ...values, email: e.target.value })}
                placeholder="asif.registrar@lawflow.pk"
                disabled={submitting || editMode}
                readOnly={editMode}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Phone Number *</label>
              <input
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#01411C]"
                value={values.phone}
                onChange={(e) => setValues({ ...values, phone: e.target.value })}
                placeholder="+92 300 1234567"
                disabled={submitting}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">CNIC Number *</label>
              <input
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#01411C] disabled:bg-gray-100"
                value={values.cnic}
                onChange={(e) => setValues({ ...values, cnic: e.target.value })}
                placeholder="12345-1234567-1"
                disabled={submitting || editMode}
                readOnly={editMode}
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
        </div>
      </section>

      <div className="flex gap-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          disabled={submitting}
        >
          Cancel
        </button>

        <button
          type="submit"
          className="flex-1 rounded-xl bg-[#01411C] px-4 py-3 text-sm font-semibold text-white hover:bg-[#024a23] disabled:opacity-60"
          disabled={submitting}
        >
          {submitText}
        </button>
      </div>
    </form>
  );
}
