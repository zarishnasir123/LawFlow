import { useEffect, useMemo, useState, type FormEvent } from "react";

export type RegistrarRole = "Registrar";

// Court options exposed in the Create form. Mirrors the Gujranwala
// District jurisdiction tree: the main District Courts complex at
// Civil Lines handles district-wide cases, and each named tehsil has
// its own lower-court bench for local matters. When the deployment
// expands to other districts the list grows here; the backend's
// `assigned_court` column is plain text so no schema change is needed.
export const REGISTRAR_COURT_OPTIONS = [
  "Gujranwala District Courts (Civil Lines)",
  "Tehsil Court — Gujranwala City & Sadar",
  "Tehsil Court — Kamoke",
  "Tehsil Court — Nowshera Virkan",
] as const;

// Tehsil options shown in the Create form. These match the entries in
// SUPPORTED_TEHSILS on the backend — the registrar.validators.js
// `validateTehsil` check does an exact case-insensitive match against
// that env list, so the two must stay in sync. Adding a new tehsil
// means appending here AND in Backend/.env (SUPPORTED_TEHSILS) +
// Backend/src/utils/location.js default.
export const REGISTRAR_TEHSIL_OPTIONS = [
  "Gujranwala City & Sadar",
  "Kamoke",
  "Nowshera Virkan",
] as const;

export type RegistrarFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  cnic: string;
  role: RegistrarRole;
  // Both optional on the form because the backend accepts a registrar
  // with no court / tehsil set yet (renders as "Not assigned" on the
  // registrar's own profile page). Empty string means "leave it
  // unassigned"; a non-empty value must be one of the constants above
  // for the backend's tehsil validator to accept it.
  assignedCourt: string;
  assignedTehsil: string;
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
      firstName: initialValues?.firstName ?? "",
      lastName: initialValues?.lastName ?? "",
      email: initialValues?.email ?? "",
      phone: initialValues?.phone ?? "",
      cnic: initialValues?.cnic ?? "",
      role: initialValues?.role ?? "Registrar",
      assignedCourt: initialValues?.assignedCourt ?? "",
      assignedTehsil: initialValues?.assignedTehsil ?? "",
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

    if (!values.firstName.trim()) return setError("First name is required.");
    if (!values.lastName.trim()) return setError("Last name is required.");
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
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">First Name *</label>
              <input
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#01411C]"
                value={values.firstName}
                onChange={(e) => setValues({ ...values, firstName: e.target.value })}
                placeholder="Muhammad"
                disabled={submitting}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Last Name *</label>
              <input
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#01411C]"
                value={values.lastName}
                onChange={(e) => setValues({ ...values, lastName: e.target.value })}
                placeholder="Asif"
                disabled={submitting}
              />
            </div>
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

          {/* Court + tehsil assignment. Both are optional at creation
              — backend stores null and the registrar's profile page
              shows "Not assigned" — but the dropdowns nudge the admin
              to fill them in. Free-text would let typos through that
              the backend's exact-match tehsil validator would later
              reject. Edit mode hides this whole block because admin
              cannot edit registrars post-creation; reassignment
              requires creating a new account. */}
          {editMode ? null : (
            <div className="grid md:grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Assigned Court</label>
                <select
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#01411C] disabled:bg-gray-100"
                  value={values.assignedCourt}
                  onChange={(e) =>
                    setValues({ ...values, assignedCourt: e.target.value })
                  }
                  disabled={submitting}
                >
                  <option value="">— Select court —</option>
                  {REGISTRAR_COURT_OPTIONS.map((court) => (
                    <option key={court} value={court}>
                      {court}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">
                  The court where this registrar processes case bundles.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Assigned Tehsil</label>
                <select
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#01411C] disabled:bg-gray-100"
                  value={values.assignedTehsil}
                  onChange={(e) =>
                    setValues({ ...values, assignedTehsil: e.target.value })
                  }
                  disabled={submitting}
                >
                  <option value="">— Select tehsil —</option>
                  {REGISTRAR_TEHSIL_OPTIONS.map((tehsil) => (
                    <option key={tehsil} value={tehsil}>
                      {tehsil}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">
                  Tehsil jurisdiction. Defines which lawyer submissions
                  route to this registrar's queue.
                </p>
              </div>
            </div>
          )}
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
