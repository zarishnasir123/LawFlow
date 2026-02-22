import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { BookOpenCheck, FileUp, PencilLine, Plus, Trash2 } from "lucide-react";

import type { CaseDomain } from "../types";
import { AdminHeader } from "../components/AdminHeader";
import LogoutConfirmationModal from "../components/modals/LogoutConfirmationModal";
import StatusToast from "../components/modals/StatusToast";
import { useTemplateCasesStore } from "../store/templateCases.store";

export default function TemplatesPage() {
  const navigate = useNavigate();
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<CaseDomain>("civil");
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");

  const [newCaseDomain, setNewCaseDomain] = useState<CaseDomain>("civil");
  const [newCaseType, setNewCaseType] = useState("");
  const [newGoverningLaw, setNewGoverningLaw] = useState("");
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [editDocState, setEditDocState] = useState<{ id: string; name: string } | null>(null);

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

  const caseCategories = useTemplateCasesStore((state) => state.caseCategories);
  const addCaseCategory = useTemplateCasesStore((state) => state.addCaseCategory);
  const deleteCaseCategory = useTemplateCasesStore((state) => state.deleteCaseCategory);
  const uploadDocumentsFromDevice = useTemplateCasesStore(
    (state) => state.uploadDocumentsFromDevice,
  );
  const updateDocument = useTemplateCasesStore((state) => state.updateDocument);
  const deleteDocument = useTemplateCasesStore((state) => state.deleteDocument);
  const toggleDocumentStatus = useTemplateCasesStore((state) => state.toggleDocumentStatus);

  const handleLogout = () => {
    localStorage.clear();
    setLogoutModalOpen(false);
    navigate({ to: "/login" });
  };

  const domainCases = useMemo(
    () => caseCategories.filter((item) => item.domain === selectedDomain),
    [caseCategories, selectedDomain],
  );

  const activeCaseId = useMemo(() => {
    const hasSelection = domainCases.some((item) => item.id === selectedCaseId);
    if (hasSelection) return selectedCaseId;
    return domainCases[0]?.id ?? "";
  }, [domainCases, selectedCaseId]);

  const selectedCase = useMemo(
    () => domainCases.find((item) => item.id === activeCaseId),
    [activeCaseId, domainCases],
  );

  const civilCount = useMemo(
    () => caseCategories.filter((item) => item.domain === "civil").length,
    [caseCategories],
  );
  const familyCount = useMemo(
    () => caseCategories.filter((item) => item.domain === "family").length,
    [caseCategories],
  );

  const showToast = (
    type: "success" | "error",
    title: string,
    message?: string,
  ) => {
    setToast({ open: true, type, title, message });
  };

  const onAddCaseCategory = () => {
    try {
      const created = addCaseCategory({
        domain: newCaseDomain,
        caseType: newCaseType,
        governingLaw: newGoverningLaw,
      });
      setNewCaseType("");
      setNewGoverningLaw("");
      setSelectedDomain(created.domain);
      setSelectedCaseId(created.id);
      showToast(
        "success",
        "Case category created",
        `${created.caseType} was added under ${created.domain === "civil" ? "Civil" : "Family"} cases.`,
      );
    } catch (error) {
      showToast(
        "error",
        "Unable to create case category",
        error instanceof Error ? error.message : "Please check form values.",
      );
    }
  };

  const onUploadFromDevice = () => {
    if (!selectedCase) return;
    try {
      const uploaded = uploadDocumentsFromDevice({
        caseCategoryId: selectedCase.id,
        files: uploadFiles.map((file) => ({
          name: file.name,
          fileName: file.name,
          fileSizeBytes: file.size,
          mimeType: file.type || "application/octet-stream",
        })),
      });
      setUploadFiles([]);
      setFileInputKey((prev) => prev + 1);
      showToast(
        "success",
        "Template documents uploaded",
        `${uploaded.length} document(s) uploaded to ${selectedCase.caseType}.`,
      );
    } catch (error) {
      showToast(
        "error",
        "Unable to upload template documents",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  };

  return (
    <>
      <LogoutConfirmationModal
        open={logoutModalOpen}
        onCancel={() => setLogoutModalOpen(false)}
        onConfirm={handleLogout}
      />
      <StatusToast
        open={toast.open}
        type={toast.type}
        title={toast.title}
        message={toast.message}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
      />

      <div className="min-h-screen bg-gray-50">
        <AdminHeader
          title="Template Documents"
          subtitle="Civil and Family Case Template Management"
          onOpenNotifications={() => navigate({ to: "/admin-notifications" })}
          onLogout={() => setLogoutModalOpen(true)}
        />

        <div className="w-full px-6 lg:px-8 xl:px-10 py-8 space-y-6">
          <section className="rounded-xl border border-green-100 bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-bold text-[#01411C]">Manage Document Templates</h1>
            <p className="mt-1 text-sm text-gray-600">
              Define case categories for Civil and Family matters, then manage all template documents required in complete case files.
            </p>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  Civil Case Categories
                </p>
                <p className="mt-1 text-2xl font-bold text-emerald-900">{civilCount}</p>
              </div>
              <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                  Family Case Categories
                </p>
                <p className="mt-1 text-2xl font-bold text-blue-900">{familyCount}</p>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-gray-900">Case Categories</h2>
                <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
                  <button
                    type="button"
                    onClick={() => setSelectedDomain("civil")}
                    className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                      selectedDomain === "civil"
                        ? "bg-[#01411C] text-white"
                        : "text-gray-600"
                    }`}
                  >
                    Civil
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDomain("family")}
                    className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                      selectedDomain === "family"
                        ? "bg-[#01411C] text-white"
                        : "text-gray-600"
                    }`}
                  >
                    Family
                  </button>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-gray-200">
                <div className="grid grid-cols-12 gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3 text-xs font-semibold uppercase text-gray-500">
                  <div className="col-span-1">#</div>
                  <div className="col-span-5">Case Type</div>
                  <div className="col-span-4">Governing Law</div>
                  <div className="col-span-2 text-right">Documents</div>
                </div>

                {domainCases.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-gray-600">
                    No case category added yet in this section.
                  </div>
                ) : (
                  domainCases.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedCaseId(item.id)}
                      className={`grid w-full grid-cols-12 gap-3 border-b border-gray-100 px-4 py-3 text-left text-sm transition last:border-b-0 ${
                        selectedCase?.id === item.id
                          ? "bg-emerald-50"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="col-span-1 font-semibold text-gray-700">{index + 1}</div>
                      <div className="col-span-5 font-medium text-gray-900">{item.caseType}</div>
                      <div className="col-span-4 text-gray-700">{item.governingLaw}</div>
                      <div className="col-span-2 flex items-center justify-end gap-2 text-xs">
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 font-semibold text-gray-700">
                          {item.documents.length} docs
                        </span>
                        <span
                          onClick={(event) => {
                            event.stopPropagation();
                            if (
                              window.confirm(
                                `Delete "${item.caseType}" and all its template documents?`,
                              )
                            ) {
                              deleteCaseCategory(item.id);
                              showToast(
                                "success",
                                "Case category deleted",
                                `${item.caseType} has been removed.`,
                              );
                            }
                          }}
                          className="inline-flex cursor-pointer rounded-md border border-rose-300 p-1.5 text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Add New Case Category</h2>
              <p className="mt-1 text-sm text-gray-600">
                Add new case type under Civil or Family.
              </p>

              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Category
                  </label>
                  <select
                    value={newCaseDomain}
                    onChange={(event) => setNewCaseDomain(event.target.value as CaseDomain)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#01411C] focus:outline-none"
                  >
                    <option value="civil">Civil</option>
                    <option value="family">Family</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Case Type
                  </label>
                  <input
                    value={newCaseType}
                    onChange={(event) => setNewCaseType(event.target.value)}
                    placeholder="e.g. Suit for Damages"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#01411C] focus:outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Governing Law
                  </label>
                  <input
                    value={newGoverningLaw}
                    onChange={(event) => setNewGoverningLaw(event.target.value)}
                    placeholder="e.g. Specific Relief Act, 1877"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#01411C] focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={onAddCaseCategory}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#01411C] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#025227]"
                >
                  <Plus className="h-4 w-4" />
                  Add Case Category
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            {!selectedCase ? (
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-gray-600">
                Select a case category to manage its template documents.
              </div>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{selectedCase.caseType}</h2>
                    <p className="text-sm text-gray-600">
                      {selectedCase.domain === "civil" ? "Civil" : "Family"} case - {selectedCase.governingLaw}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                    <BookOpenCheck className="h-3.5 w-3.5" />
                    {selectedCase.documents.length} Template Documents
                  </span>
                </div>

                <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    Upload from Device
                  </p>
                  <div className="flex flex-col gap-2 md:flex-row md:items-center">
                    <input
                      key={fileInputKey}
                      type="file"
                      multiple
                      accept=".doc,.docx,.pdf,.txt,.rtf"
                      onChange={(event) =>
                        setUploadFiles(Array.from(event.target.files ?? []))
                      }
                      className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-emerald-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-emerald-900"
                    />
                    <button
                      type="button"
                      onClick={onUploadFromDevice}
                      disabled={uploadFiles.length === 0}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#01411C] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#025227] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <FileUp className="h-4 w-4" />
                      Upload
                    </button>
                  </div>
                  {uploadFiles.length > 0 ? (
                    <p className="mt-2 text-xs font-medium text-emerald-700">
                      {uploadFiles.length} file(s) selected
                    </p>
                  ) : null}
                </div>

                <div className="overflow-hidden rounded-xl border border-gray-200">
                  <div className="grid grid-cols-12 gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3 text-xs font-semibold uppercase text-gray-500">
                    <div className="col-span-5">Document Name</div>
                    <div className="col-span-2">Status</div>
                    <div className="col-span-3">Updated</div>
                    <div className="col-span-2 text-right">Actions</div>
                  </div>

                  {selectedCase.documents.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-gray-600">
                      No template document added yet for this case category.
                    </div>
                  ) : (
                    selectedCase.documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="grid grid-cols-12 gap-3 border-b border-gray-100 px-4 py-3 text-sm last:border-b-0"
                      >
                        <div className="col-span-5">
                          {editDocState?.id === doc.id ? (
                            <input
                              value={editDocState.name}
                              onChange={(event) =>
                                setEditDocState({
                                  id: doc.id,
                                  name: event.target.value,
                                })
                              }
                              className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-[#01411C] focus:outline-none"
                            />
                          ) : (
                            <div>
                              <span className="font-medium text-gray-900">{doc.name}</span>
                              <p className="text-xs text-gray-500">
                                {doc.source === "device_upload"
                                  ? `Uploaded file: ${doc.fileName ?? doc.name}`
                                  : "Manual template entry"}
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="col-span-2">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                              doc.status === "active"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-gray-200 text-gray-600"
                            }`}
                          >
                            {doc.status === "active" ? "Active" : "Archived"}
                          </span>
                        </div>

                        <div className="col-span-3 text-gray-600">
                          {new Date(doc.updatedAt).toLocaleString()}
                        </div>

                        <div className="col-span-2 flex justify-end gap-2">
                          {editDocState?.id === doc.id ? (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  try {
                                    updateDocument({
                                      caseCategoryId: selectedCase.id,
                                      documentId: doc.id,
                                      name: editDocState.name,
                                    });
                                    setEditDocState(null);
                                    showToast(
                                      "success",
                                      "Document updated",
                                      "Template document name has been updated.",
                                    );
                                  } catch (error) {
                                    showToast(
                                      "error",
                                      "Unable to update document",
                                      error instanceof Error ? error.message : "Please try again.",
                                    );
                                  }
                                }}
                                className="rounded-lg border border-emerald-300 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditDocState(null)}
                                className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  setEditDocState({
                                    id: doc.id,
                                    name: doc.name,
                                  })
                                }
                                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                              >
                                <PencilLine className="h-3.5 w-3.5" />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  toggleDocumentStatus(selectedCase.id, doc.id)
                                }
                                className="rounded-lg border border-blue-300 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                              >
                                {doc.status === "active" ? "Archive" : "Activate"}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  deleteDocument(selectedCase.id, doc.id);
                                  showToast(
                                    "success",
                                    "Document deleted",
                                    `${doc.name} template removed.`,
                                  );
                                }}
                                className="inline-flex items-center gap-1 rounded-lg border border-rose-300 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
