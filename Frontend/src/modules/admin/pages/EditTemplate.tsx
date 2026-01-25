import { useNavigate, useParams } from "@tanstack/react-router";
import TemplateForm from "../components/TemplateForm";
import { templatesStore } from "../data/templates.store";
import type { Template } from "../data/templates.store";

export default function EditTemplate() {
  const navigate = useNavigate();

  //  id URL se string aata hai
  const { id } = useParams({ from: "/admin-templates/edit/$id" });

  //  string → number
  const templateId = Number(id);

  //  template safely find
  const template = templatesStore.find(
    (t: Template) => t.id === templateId
  );

  //  safety guard (agar galat id ho)
  if (!template) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Template not found</p>
      </div>
    );
  }

  return (
    <TemplateForm
      initialValues={template}
      onSubmit={(data) => {
        Object.assign(template, data);
        navigate({ to: "/admin-templates" });
      }}
    />
  );
}
