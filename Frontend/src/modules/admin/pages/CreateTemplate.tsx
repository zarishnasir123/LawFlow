import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Save } from "lucide-react";

export default function CreateTemplate() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");

  const handleCreate = () => {
    if (!name || !category) {
      alert("Name and category are required");
      return;
    }

    // later: API call
    console.log({
      name,
      category,
      description,
    });

    // back to manage templates
    navigate({ to: "/admin-templates" });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate({ to: "/admin-templates" })}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft />
          </button>
          <h1 className="text-xl font-bold">Create New Template</h1>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1">
            Template Name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
            placeholder="e.g. Civil Suit Template"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Category
          </label>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
            placeholder="Civil / Family / Criminal"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full border rounded-lg px-3 py-2"
            placeholder="Short description about this template"
          />
        </div>

        <button
          onClick={handleCreate}
          className="flex items-center gap-2 bg-green-600 text-white px-5 py-2 rounded-lg hover:bg-green-700"
        >
          <Save className="w-4 h-4" />
          Create Template
        </button>
      </div>
    </div>
  );
}
