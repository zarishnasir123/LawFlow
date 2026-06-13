import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import RegistrarForm from "../components/RegistrarForm";
import type { RegistrarFormValues } from "../components/RegistrarForm";
import { createRegistrar } from "../api/registrars";
import StatusToast from "../components/modals/StatusToast";
import { extractApiErrorMessage } from "../../../shared/api/extractApiErrorMessage";

export default function CreateRegistrar() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{
    open: boolean;
    type: "success" | "error";
    title: string;
    message?: string;
  }>({
    open: false,
    type: "success",
    title: "",
  });

  const handleSubmit = async (values: RegistrarFormValues) => {
    setSubmitting(true);
    try {
      // Court / tehsil are optional. Empty string means the admin left
      // the dropdown on "— Select —"; forward `null` so the backend
      // stores NULL (the registrar's profile renders "Not assigned")
      // rather than an empty string.
      const { registrar, emailDelivery } = await createRegistrar({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email,
        phone: values.phone,
        cnic: values.cnic,
        assignedCourt: values.assignedCourt.trim() || null,
        assignedTehsil: values.assignedTehsil.trim() || null,
      });

      // Account creation succeeded server-side regardless of email outcome.
      // Distinguish "credentials dispatched" from "account created but SMTP
      // could not deliver" so the admin knows whether to re-issue
      // credentials manually. `emailSent` (synchronous) and `emailQueued`
      // (asynchronous) both count as success — both mean the credential
      // is en route to the registrar's inbox.
      const dispatchedOk =
        emailDelivery.emailSent === true || emailDelivery.emailQueued === true;

      if (dispatchedOk) {
        setToast({
          open: true,
          type: "success",
          title: "Credentials email sent",
          message: `Registrar account for ${registrar.firstName} ${registrar.lastName} created and credentials sent to ${registrar.email}.`,
        });
      } else {
        setToast({
          open: true,
          type: "error",
          title: "Account created — email NOT delivered",
          message: `Registrar account for ${registrar.firstName} ${registrar.lastName} was created, but the credentials email could not be delivered (${emailDelivery.deliveryReason ?? "SMTP unavailable"}). Use the "Send" action on the registrar list once email is configured.`,
        });
      }
      window.setTimeout(() => navigate({ to: "/registrars" }), 1800);
    } catch (error) {
      setToast({
        open: true,
        type: "error",
        title: "Registrar creation failed",
        message: extractApiErrorMessage(error, "Unable to create registrar."),
      });
    } finally {
      setSubmitting(false);
    }
  };

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
            title="Create New Registrar"
            subtitle="A secure temporary password will be generated and emailed to the registrar."
            submitText={submitting ? "Creating..." : "Create Registrar"}
            submitting={submitting}
            onCancel={() => navigate({ to: "/registrars" })}
            onSubmit={handleSubmit}
          />
        </div>
      </div>
    </>
  );
}
