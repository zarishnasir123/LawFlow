import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  Search,
  FileText,
  Edit,
  Plus,
  Download,
  Eye,
} from "lucide-react";

type Template = {
  id: number;
  name: string;
  category: string;
  description: string;
  lastModified: string;
  usageCount: number;
  fileSize: string;
};

export default function ManageTemplates() {
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null
  );

  // ✅ REAL LIST (state-based)
  const [templates, setTemplates] = useState<Template[]>([
    {
      id: 1,
      name: "Civil Suit Template",
      category: "Civil",
      description: "Standard template for civil litigation cases",
      lastModified: "Mar 15, 2024",
      usageCount: 234,
      fileSize: "45 KB",
    },
    {
      id: 2,
      name: "Family Court Petition",
      category: "Family",
      description: "Template for family court petitions",
      lastModified: "Feb 28, 2024",
      usageCount: 156,
      fileSize: "42 KB",
    },
  ]);

  const categories = ["all", "Civil", "Family"];

  const filteredTemplates = templates.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      filterCategory === "all" || t.category === filterCategory;

    return matchesSearch && matchesCategory;
  });

  // ✅ REAL DELETE
  const handleDelete = () => {
    if (!selectedTemplate) return;

    setTemplates((prev) =>
      prev.filter((t) => t.id !== selectedTemplate.id)
    );

    setShowDeleteDialog(false);
    setSelectedTemplate(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* HEADER */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate({ to: ".." })}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div>
              <h1 className="text-xl font-bold">Manage Templates</h1>
              <p className="text-sm text-gray-600">
                Configure and manage document templates
              </p>
            </div>
          </div>

          {/* CREATE */}
          <button
            onClick={() => navigate({ to: "/admin-templates/create" })}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Plus className="w-4 h-4" />
            New Template
          </button>
        </div>
      </header>

      {/* CONTENT */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* FILTERS */}
        <div className="bg-white p-4 rounded-lg border mb-6 flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates..."
              className="w-full pl-9 pr-4 py-2 border rounded-lg"
            />
          </div>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === "all" ? "All Categories" : c}
              </option>
            ))}
          </select>
        </div>

        {/* GRID */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((t) => (
            <div
              key={t.id}
              className="bg-white border rounded-lg p-6 hover:shadow-md"
            >
              <div className="flex justify-between mb-4">
                <FileText className="text-green-600" />
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                  {t.category}
                </span>
              </div>

              <h3 className="font-semibold">{t.name}</h3>
              <p className="text-sm text-gray-600 mb-4">{t.description}</p>

              {/* ACTIONS */}
              <div className="grid grid-cols-3 gap-2">
                <button className="p-2 hover:bg-gray-100 rounded">
                  <Eye className="w-4 h-4" />
                </button>

                {/* ✅ EDIT — ROUTER SAFE */}
                <button
                  onClick={() =>
                    navigate({
                      to: "/admin-templates/edit/$id",
                      params: { id: String(t.id) },
                    })
                  }
                  className="p-2 hover:bg-gray-100 rounded"
                >
                  <Edit className="w-4 h-4" />
                </button>

                <button className="p-2 hover:bg-gray-100 rounded">
                  <Download className="w-4 h-4" />
                </button>
              </div>

              {/* DELETE */}
              <button
                onClick={() => {
                  setSelectedTemplate(t);
                  setShowDeleteDialog(true);
                }}
                className="w-full mt-3 text-sm text-red-600 border border-red-300 rounded-lg py-2"
              >
                Delete Template
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* DELETE MODAL */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h3 className="font-semibold mb-2">Delete Template</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete{" "}
              <strong>{selectedTemplate?.name}</strong>?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteDialog(false)}
                className="flex-1 border py-2 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
