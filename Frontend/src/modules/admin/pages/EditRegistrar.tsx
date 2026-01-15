import { useNavigate, useParams } from "@tanstack/react-router";
import RegistrarForm, { type RegistrarFormValues } from "../components/RegistrarForm";

export default function EditRegistrar() {
  const navigate = useNavigate();

  // ✅ MUST match router.tsx route:
  // path: "admin-registrars/edit/$id"
  const { id } = useParams({ from: "/admin-registrars/edit/$id" });

  const initialValues: Partial<RegistrarFormValues> = {
    name: "Muhammad Asif",
    email: "asif.registrar@lawflow.pk",
    phone: "+92 300 1234567",
    cnic: "12345-1234567-1",
    role: "Registrar",
    permissions: ["view_cases", "process_cases"],
  };

  const handleSubmit = (values: RegistrarFormValues) => {
    alert(`Registrar "${values.name}" (id: ${id}) updated successfully!`);
    navigate({ to: "/admin-registrars" });
  };

  return (
    <RegistrarForm
      title="Edit Registrar"
      subtitle={`Update registrar (ID: ${id})`}
      initialValues={initialValues}
      showPasswordFields={false}
      submitText="Update Registrar"
      onCancel={() => navigate({ to: "/admin-registrars" })}
      onSubmit={handleSubmit}
    />
  );
}
