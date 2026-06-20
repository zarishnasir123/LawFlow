import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  Eye,
  FileText,
  FileUp,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import {
  CASE_TYPES_QUERY_KEY,
  createCaseType,
  deleteCaseType,
  fetchCaseTypes,
  fetchCaseTypeTemplateBytes,
  removeCaseTypeTemplate,
  uploadCaseTypeTemplate,
  type AdminCaseType,
  type CaseCategory,
  type TemplateStatus,
} from "../api/caseTypes";
import { extractApiErrorMessage } from "../../../shared/api/extractApiErrorMessage";
import StatusToast from "../components/modals/StatusToast";
import DeleteCaseTypeModal from "../components/modals/DeleteCaseTypeModal";
import CaseTemplatePreview from "../components/CaseTemplatePreview";

const TEMPLATE_STATUS_BADGE: Record<
  TemplateStatus,
  { label: string; cls: string }
> = {
  custom: { label: "Custom", cls: "bg-emerald-100 text-emerald-700" },
  default: { label: "Default", cls: "bg-blue-100 text-blue-700" },
  missing: { label: "Missing", cls: "bg-amber-100 text-amber-700" },
};

function formatFileSize(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

type Toast = {
  open: boolean;
  type: "success" | "error";
  title: string;
  message?: string;
};

export default function TemplatesPage() {
  const queryClient = useQueryClient();

  const [selectedCategory, setSelectedCategory] = useState<CaseCategory>("civil");
  const [selectedId, setSelectedId] = useState<string>("");

  const [newCategory, setNewCategory] = useState<CaseCategory>("civil");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newGoverningLaw, setNewGoverningLaw] = useState("");

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  const [deleteTarget, setDeleteTarget] = useState<AdminCaseType | null>(null);

  // Page-by-page preview modal. `buffer` is the .docx bytes being rendered
  // (the picked file, or the stored template fetched from the backend).
  const [preview, setPreview] = useState<{
    title: string;
    fileSize: number | null;
    buffer: ArrayBuffer | null;
    loading: boolean;
    error: string | null;
  } | null>(null);
  const [previewPageCount, setPreviewPageCount] = useState<number | null>(null);

  const [toast, setToast] = useState<Toast>({
    open: false,
    type: "success",
    title: "",
  });

  const showToast = (
    type: "success" | "error",
    title: string,
    message?: string
  ) => setToast({ open: true, type, title, message });

  const caseTypesQuery = useQuery({
    queryKey: CASE_TYPES_QUERY_KEY,
    queryFn: fetchCaseTypes,
  });

  const caseTypes = useMemo(
    () => caseTypesQuery.data ?? [],
    [caseTypesQuery.data]
  );

  const civilCount = useMemo(
    () => caseTypes.filter((t) => t.category === "civil").length,
    [caseTypes]
  );
  const familyCount = useMemo(
    () => caseTypes.filter((t) => t.category === "family").length,
    [caseTypes]
  );

  const categoryTypes = useMemo(
    () => caseTypes.filter((t) => t.category === selectedCategory),
    [caseTypes, selectedCategory]
  );

  // Resolve the active row without writing state during render: keep the
  // explicit selection when it's still in the current category, else fall
  // back to the first row.
  const activeId = useMemo(() => {
    if (categoryTypes.some((t) => t.id === selectedId)) return selectedId;
    return categoryTypes[0]?.id ?? "";
  }, [categoryTypes, selectedId]);

  const selectedType = useMemo(
    () => caseTypes.find((t) => t.id === activeId) ?? null,
    [caseTypes, activeId]
  );

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: CASE_TYPES_QUERY_KEY });

  const createMutation = useMutation({
    mutationFn: createCaseType,
    onSuccess: (created) => {
      invalidate();
      setSelectedCategory(created.category);
      setSelectedId(created.id);
      setNewDisplayName("");
      setNewGoverningLaw("");
      showToast(
        "success",
        "Case type created",
        `${created.displayName} was added. Upload a template to make it available to lawyers.`
      );
    },
    onError: (error) =>
      showToast(
        "error",
        "Could not create case type",
        extractApiErrorMessage(error, "Please try again.")
      ),
  });

  const uploadMutation = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      uploadCaseTypeTemplate(id, file),
    onSuccess: (updated) => {
      invalidate();
      setPendingFile(null);
      setFileInputKey((k) => k + 1);
      showToast(
        "success",
        "Template uploaded",
        `${updated.displayName} now uses your uploaded template.`
      );
    },
    onError: (error) =>
      showToast("error", "Upload failed", extractApiErrorMessage(error, "Please try again.")),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => removeCaseTypeTemplate(id),
    onSuccess: (updated) => {
      invalidate();
      showToast(
        "success",
        "Template removed",
        updated.isBuiltIn
          ? `${updated.displayName} reverted to its built-in default.`
          : `${updated.displayName} has no template now and is hidden from lawyers until you upload one.`
      );
    },
    onError: (error) =>
      showToast("error", "Could not remove template", extractApiErrorMessage(error, "Please try again.")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCaseType(id),
    onSuccess: () => {
      invalidate();
      const removedId = deleteTarget?.id;
      const removedName = deleteTarget?.displayName;
      setDeleteTarget(null);
      if (removedId === selectedId) setSelectedId("");
      showToast(
        "success",
        "Case type deleted",
        `${removedName ?? "The case type"} has been removed.`
      );
    },
    onError: (error) =>
      showToast("error", "Could not delete case type", extractApiErrorMessage(error, "Please try again.")),
  });

  const onAddCaseType = () => {
    const name = newDisplayName.trim();
    if (!name) {
      showToast("error", "Name required", "Enter a name for the case type.");
      return;
    }
    createMutation.mutate({
      category: newCategory,
      displayName: name,
      governingLaw: newGoverningLaw.trim() || undefined,
    });
  };

  const onUpload = () => {
    if (!selectedType || !pendingFile) return;
    uploadMutation.mutate({ id: selectedType.id, file: pendingFile });
  };

  // Preview the file the admin just picked, before uploading — so they can
  // confirm it's the right document and see how many pages it has.
  const onPreviewSelectedFile = async () => {
    if (!pendingFile) return;
    setPreviewPageCount(null);
    setPreview({
      title: `Selected file — ${pendingFile.name}`,
      fileSize: pendingFile.size,
      buffer: null,
      loading: true,
      error: null,
    });
    try {
      const buffer = await pendingFile.arrayBuffer();
      setPreview((prev) => (prev ? { ...prev, buffer, loading: false } : prev));
    } catch {
      setPreview((prev) =>
        prev ? { ...prev, loading: false, error: "Could not read the file." } : prev
      );
    }
  };

  // Preview the template currently in place for a type (the admin upload, or
  // the built-in default). Streams the bytes from the admin-gated endpoint.
  const onPreviewCurrentTemplate = async (caseType: AdminCaseType) => {
    setPreviewPageCount(null);
    setPreview({
      title: `Current template — ${caseType.displayName}`,
      fileSize: caseType.template?.fileSize ?? null,
      buffer: null,
      loading: true,
      error: null,
    });
    try {
      const buffer = await fetchCaseTypeTemplateBytes(caseType.id);
      setPreview((prev) => (prev ? { ...prev, buffer, loading: false } : prev));
    } catch (error) {
      setPreview((prev) =>
        prev
          ? {
              ...prev,
              loading: false,
              error: extractApiErrorMessage(
                error,
                "Could not load the template."
              ),
            }
          : prev
      );
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

      <DeleteCaseTypeModal
        open={deleteTarget !== null}
        caseTypeName={deleteTarget?.displayName ?? ""}
        inUse={deleteTarget?.inUse ?? false}
        caseCount={deleteTarget?.caseCount ?? 0}
        deleting={deleteMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />

      {preview ? (
        <div className="fixed inset-0 z-[65] flex flex-col bg-black/50 p-4 sm:p-8">
          <div className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900">
                  {preview.title}
                </p>
                <p className="text-xs text-gray-500">
                  {preview.loading
                    ? "Loading…"
                    : preview.error
                      ? "Could not preview"
                      : `${previewPageCount ?? "…"} page${
                          previewPageCount === 1 ? "" : "s"
                        } · ${formatFileSize(preview.fileSize)}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <X className="h-4 w-4" />
                Close
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              {preview.error ? (
                <div className="flex h-full items-center justify-center px-6 text-center text-sm text-rose-600">
                  {preview.error}
                </div>
              ) : (
                <CaseTemplatePreview
                  arrayBuffer={preview.buffer}
                  isLoading={preview.loading}
                  onPageCount={setPreviewPageCount}
                />
              )}
            </div>
          </div>
        </div>
      ) : null}

      <div className="w-full px-6 lg:px-8 xl:px-10 py-8 space-y-6">
        <section className="rounded-xl border border-green-100 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-[#01411C]">
            Manage Case Templates
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Each case type has one complete Word template that lawyers draft from.
            Upload or replace a type&apos;s template, add new case types under
            Civil or Family, and remove or delete types you no longer need.
          </p>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Civil Case Types
              </p>
              <p className="mt-1 text-2xl font-bold text-emerald-900">
                {civilCount}
              </p>
            </div>
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                Family Case Types
              </p>
              <p className="mt-1 text-2xl font-bold text-blue-900">
                {familyCount}
              </p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900">Case Types</h2>
              <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
                <button
                  type="button"
                  onClick={() => setSelectedCategory("civil")}
                  className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                    selectedCategory === "civil"
                      ? "bg-[#01411C] text-white"
                      : "text-gray-600"
                  }`}
                >
                  Civil
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategory("family")}
                  className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                    selectedCategory === "family"
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
                <div className="col-span-4">Case Type</div>
                <div className="col-span-3">Governing Law</div>
                <div className="col-span-2">Template</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>

              {caseTypesQuery.isLoading ? (
                <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading case types…
                </div>
              ) : caseTypesQuery.isError ? (
                <div className="px-4 py-8 text-center text-sm text-rose-600">
                  Could not load case types. Please refresh the page.
                </div>
              ) : categoryTypes.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-600">
                  No case types in this section yet.
                </div>
              ) : (
                categoryTypes.map((item, index) => {
                  const badge = TEMPLATE_STATUS_BADGE[item.templateStatus];
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className={`grid w-full grid-cols-12 gap-3 border-b border-gray-100 px-4 py-3 text-left text-sm transition last:border-b-0 ${
                        selectedType?.id === item.id
                          ? "bg-emerald-50"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="col-span-1 font-semibold text-gray-700">
                        {index + 1}
                      </div>
                      <div className="col-span-4">
                        <span className="font-medium text-gray-900">
                          {item.displayName}
                        </span>
                        {item.isBuiltIn ? (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
                            <BadgeCheck className="h-3 w-3" />
                            Built-in
                          </span>
                        ) : null}
                      </div>
                      <div className="col-span-3 text-gray-700">
                        {item.governingLaw ?? "—"}
                      </div>
                      <div className="col-span-2">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <div className="col-span-2 flex items-center justify-end">
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(event) => {
                            event.stopPropagation();
                            setDeleteTarget(item);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.stopPropagation();
                              setDeleteTarget(item);
                            }
                          }}
                          title="Delete case type"
                          className="inline-flex cursor-pointer rounded-md border border-rose-300 p-1.5 text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">
              Add New Case Type
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Add a new case type under Civil or Family. It stays hidden from
              lawyers until you upload its template.
            </p>

            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Category
                </label>
                <select
                  value={newCategory}
                  onChange={(event) =>
                    setNewCategory(event.target.value as CaseCategory)
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#01411C] focus:outline-none"
                >
                  <option value="civil">Civil</option>
                  <option value="family">Family</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Case Type Name
                </label>
                <input
                  value={newDisplayName}
                  onChange={(event) => setNewDisplayName(event.target.value)}
                  placeholder="e.g. Suit for Damages"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#01411C] focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Governing Law{" "}
                  <span className="font-normal normal-case text-gray-400">
                    (optional)
                  </span>
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
                onClick={onAddCaseType}
                disabled={createMutation.isPending}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#01411C] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#025227] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Add Case Type
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          {!selectedType ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-gray-600">
              Select a case type to manage its template.
            </div>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {selectedType.displayName}
                  </h2>
                  <p className="text-sm text-gray-600">
                    {selectedType.category === "civil" ? "Civil" : "Family"} case
                    {selectedType.governingLaw
                      ? ` · ${selectedType.governingLaw}`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                      TEMPLATE_STATUS_BADGE[selectedType.templateStatus].cls
                    }`}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    {selectedType.templateStatus === "custom"
                      ? "Custom template"
                      : selectedType.templateStatus === "default"
                        ? "Built-in default"
                        : "No template yet"}
                  </span>
                  {selectedType.templateStatus !== "missing" ? (
                    <button
                      type="button"
                      onClick={() => onPreviewCurrentTemplate(selectedType)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Preview
                    </button>
                  ) : null}
                </div>
              </div>

              {selectedType.template ? (
                <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      File
                    </p>
                    <p className="mt-1 truncate text-sm font-medium text-gray-900">
                      {selectedType.template.fileName ?? "template.docx"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Size
                    </p>
                    <p className="mt-1 text-sm font-medium text-gray-900">
                      {formatFileSize(selectedType.template.fileSize)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Uploaded
                    </p>
                    <p className="mt-1 text-sm font-medium text-gray-900">
                      {formatDateTime(selectedType.template.updatedAt)}
                    </p>
                  </div>
                </div>
              ) : selectedType.templateStatus === "default" ? (
                <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                  This type uses LawFlow&apos;s built-in template. Upload a Word
                  file below to replace it with your own version.
                </div>
              ) : (
                <div className="mb-4 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  This type has no template yet, so lawyers can&apos;t see it.
                  Upload a Word file to make it available.
                </div>
              )}

              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  {selectedType.templateStatus === "custom"
                    ? "Replace template"
                    : "Upload template"}{" "}
                  (Word .docx)
                </p>
                <div className="flex flex-col gap-2 md:flex-row md:items-center">
                  <input
                    key={fileInputKey}
                    type="file"
                    accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(event) =>
                      setPendingFile(event.target.files?.[0] ?? null)
                    }
                    className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-emerald-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-emerald-900"
                  />
                  <button
                    type="button"
                    onClick={onUpload}
                    disabled={!pendingFile || uploadMutation.isPending}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#01411C] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#025227] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {uploadMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileUp className="h-4 w-4" />
                    )}
                    {selectedType.templateStatus === "custom"
                      ? "Replace"
                      : "Upload"}
                  </button>
                  {pendingFile ? (
                    <button
                      type="button"
                      onClick={onPreviewSelectedFile}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      <Eye className="h-4 w-4" />
                      Preview file
                    </button>
                  ) : null}
                  {selectedType.templateStatus === "custom" ? (
                    <button
                      type="button"
                      onClick={() => removeMutation.mutate(selectedType.id)}
                      disabled={removeMutation.isPending}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-300 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {removeMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      Remove
                    </button>
                  ) : null}
                </div>
                {pendingFile ? (
                  <p className="mt-2 text-xs font-medium text-emerald-700">
                    Selected: {pendingFile.name} ({formatFileSize(pendingFile.size)})
                  </p>
                ) : null}
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}
