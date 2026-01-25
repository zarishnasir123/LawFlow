import { useState } from "react";
import { Save } from "lucide-react";

type Props = {
  initialValues: {
    name: string;
    category: string;
    description: string;
  };
  onSubmit: (data: {
    name: string;
    category: string;
    description: string;
  }) => void;
};

export default function TemplateForm({ initialValues, onSubmit }: Props) {
  const [form, setForm] = useState(initialValues);

  return (
    <div className="space-y-4">
      <input
        className="w-full border px-3 py-2 rounded"
        placeholder="Template Name"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
      />

      <input
        className="w-full border px-3 py-2 rounded"
        placeholder="Category"
        value={form.category}
        onChange={(e) => setForm({ ...form, category: e.target.value })}
      />

      <textarea
        className="w-full border px-3 py-2 rounded"
        placeholder="Description"
        rows={4}
        value={form.description}
        onChange={(e) =>
          setForm({ ...form, description: e.target.value })
        }
      />

      <button
        onClick={() => onSubmit(form)}
        className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded"
      >
        <Save className="w-4 h-4" />
        Save Template
      </button>
    </div>
  );
}
