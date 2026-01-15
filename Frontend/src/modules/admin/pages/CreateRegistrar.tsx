import { useNavigate } from "@tanstack/react-router";
import RegistrarForm from "../components/RegistrarForm";
import type { RegistrarFormValues } from "../components/RegistrarForm";

export default function CreateRegistrar() {
  const navigate = useNavigate();

  const handleSubmit = (values: RegistrarFormValues) => {
    alert(`Registrar "${values.name}" created successfully!`);
    navigate({ to: "/admin-registrars" });
  };

  return (
    <RegistrarForm
      title="Create New Registrar"
      subtitle="Add a new registrar account"
      showPasswordFields
      submitText="Create Registrar"
      onCancel={() => navigate({ to: "/admin-registrars" })}
      onSubmit={handleSubmit}
    />
  );
}
