import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { AxiosError } from "axios";

import RegistrarForm, { type RegistrarFormValues } from "../components/RegistrarForm";
import {
  fetchRegistrar,
  updateRegistrar,
  type Registrar,
} from "../api/registrars";
import StatusToast from "../components/modals/StatusToast";
import { extractApiErrorMessage } from "../../../shared/api/extractApiErrorMessage";

function splitFullName(fullName: string): { firstName: string; lastName: string } | null {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2 || !parts[0] || !parts[parts.length - 1]) {
    return null;
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

export default function EditRegistrar() {
  const navigate = useNavigate();
  const { id } = useParams({ from: "/_admin/registrars/edit/$id" });

  const [registrar, setRegistrar] = useState<Registrar | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{
    open: boolean;
    type: "success" | "error";
    title: string;
    message?: string;
  }>({ open: false, type: "success", title: "" });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const match = await fetchRegistrar(id);
        if (cancelled) return;
        setRegistrar(match);
      } catch (error) {
        if (!cancelled) {
          // Translate a 404 into the friendlier "not found" message so the
          // page renders a back-to-list affordance rather than a generic
          // network error.
          if (error instanceof AxiosError && error.response?.status === 404) {
            setLoadError("Registrar not found.");
          } else {
            setLoadError(extractApiErrorMessage(error, "Unable to load registrar."));
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const initialValues: Partial<RegistrarFormValues> = useMemo(
    () => ({
      name: registrar ? `${registrar.firstName} ${registrar.lastName}`.trim() : "",
      email: registrar?.email ?? "",
      phone: registrar?.phone ?? "",
      cnic: registrar?.cnic ?? "",
      role: "Registrar",
    }),
    [registrar],
  );

  const handleSubmit = async (values: RegistrarFormValues) => {
    const nameParts = splitFullName(values.name);
    if (!nameParts) {
      setToast({
        open: true,
        type: "error",
        title: "Update failed",
        message: "Please enter first name and last name.",
      });
      return;
    }

    setSubmitting(true);
    try {
      await updateRegistrar({
        registrarProfileId: id,
        firstName: nameParts.firstName,
        lastName: nameParts.lastName,
        phone: values.phone,
      });

      setToast({
        open: true,
        type: "success",
        title: "Registrar updated",
        message: `${values.name} updated successfully.`,
      });
      window.setTimeout(() => navigate({ to: "/registrars" }), 900);
    } catch (error) {
      setToast({
        open: true,
        type: "error",
        title: "Update failed",
        message: extractApiErrorMessage(error, "Unable to update registrar."),
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || loadError || !registrar) {
    return (
      <div className="w-full px-6 lg:px-8 xl:px-10 py-8">
        <div className="mx-auto max-w-2xl rounded-xl border border-gray-200 bg-white p-6 text-gray-700">
          {loading ? (
            "Loading registrar..."
          ) : (
            <>
              <div className="text-rose-700">{loadError ?? "Registrar not found."}</div>
              <button
                type="button"
                onClick={() => navigate({ to: "/registrars" })}
                className="mt-3 rounded-lg border border-rose-300 px-3 py-1 text-sm"
              >
                Back to Registrars
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <StatusToast
        open={toast.open}
        type={toast.type}
        title={toast.title}
        message={toast.message}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
      />

      <div className="w-full px-6 lg:px-8 xl:px-10 py-8">
        <div className="mx-auto max-w-4xl">
          <RegistrarForm
            title="Edit Registrar"
            subtitle="Update registrar account details"
            initialValues={initialValues}
            editMode
            submitText={submitting ? "Updating..." : "Update Registrar"}
            submitting={submitting}
            onCancel={() => navigate({ to: "/registrars" })}
            onSubmit={handleSubmit}
          />
        </div>
      </div>
    </>
  );
}
