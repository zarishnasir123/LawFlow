import { useEffect, useState, useCallback, useRef } from "react";
import * as mammoth from "mammoth";
import { type JSONContent } from "@tiptap/react";
import { Bell, LogOut, User } from "lucide-react";
import { useNavigate, useParams } from "@tanstack/react-router";
import DashboardLayout from "../../../shared/components/dashboard/DashboardLayout";
import DocumentSidebar from "../components/documentEditor/DocumentSidebar";
import DocEditor from "../components/documentEditor/DocEditor";
import TopActionBar from "../components/documentEditor/TopActionBar";
import DownloadModal from "../components/documentEditor/DownloadModal";
import SignatureRequestPanel from "../signatures/components/SignatureRequestPanel";
import { useDocumentEditorStore } from "../store/documentEditor.store";
import { useSignatureRequestsStore } from "../signatures/store/signatureRequests.store";

const DOCS = [
  {
    id: "plaint",
    title: "Plaint",
    url: "/templates/civil/recovery-of-money/01_Plaint_Suit_for_Recovery_of_Money.docx",
  },
  {
    id: "affidavit",
    title: "Affidavit",
    url: "/templates/civil/recovery-of-money/02_Affidavit_In_Support.docx",
  },
  {
    id: "vakalatnama",
    title: "Vakalatnama",
    url: "/templates/civil/recovery-of-money/03_Vakalatnama.docx",
  },
  {
    id: "witnesses",
    title: "List of Witnesses",
    url: "/templates/civil/recovery-of-money/04_List_of_Witnesses.docx",
  },
  {
    id: "annexures",
    title: "Annexures",
    url: "/templates/civil/recovery-of-money/05_List_of_Documents_Annexures.docx",
  },
];

export default function CaseDocumentEditor() {
  const navigate = useNavigate();
  const { caseId } = useParams({ strict: false }) as { caseId?: string }; // Retrieve generic params

  const {
    currentDocId,
    setCurrentDocId,
    activeEditorRef,
    documentsById,
    attachmentsById,
    saveDocumentJSON,
    getDocumentJSON,
    setLoading,
    isLoading,
    saveDraft,
    loadDraft,
    addAttachment,
    addUploadedDocument,
    initializeDefaultBundle,
    bundleItems,
  } = useDocumentEditorStore();

  const { countPendingSignatures } = useSignatureRequestsStore();

  const [editorContent, setEditorContent] = useState<string | JSONContent>("");
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [isSignaturePanelOpen, setIsSignaturePanelOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  const signaturePendingCount = caseId
    ? countPendingSignatures(caseId)
    : undefined;

  // Load draft on mount (or initialize defaults)
  useEffect(() => {
    // If caseId is present, load that specific draft. Otherwise generic.
    loadDraft(caseId);

    // We only init defaults if the bundle is empty (handled inside store or here?)
    // initializeDefaultBundle checks emptiness internally.
    initializeDefaultBundle(DOCS);
  }, [loadDraft, initializeDefaultBundle, caseId]);

  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (currentDocId && activeEditorRef) {
        saveDocumentJSON(currentDocId, activeEditorRef.getJSON());
        saveDraft(caseId);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [currentDocId, activeEditorRef, saveDocumentJSON, saveDraft, caseId]);

  const loadDocument = useCallback(
    async (docId: string) => {
      // Check if content is cached (JSON)
      const cachedJSON = getDocumentJSON(docId);
      if (cachedJSON) {
        setCurrentDocId(docId);
        setEditorContent(cachedJSON);
        return;
      }

      // Check for legacy HTML (migration)
      const docData = documentsById[docId];
      if (docData?.legacyHtml) {
        setCurrentDocId(docId);
        setEditorContent(docData.legacyHtml);
        return;
      }

      // Load from DOCX
      const doc = DOCS.find((d) => d.id === docId);
      if (!doc) return;

      setCurrentDocId(docId);
      setLoading(true);

      try {
        console.log(`[DOCX Loader] Loading document: ${doc.title}`);

        // ... (existing fetch logic) ...
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(doc.url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        const htmlContent = result.value;

        // Initialize as HTML (DocEditor will handle it)
        setEditorContent(htmlContent);
        // Note: We don't save immediately, wait for auto-save or edit
      } catch (error) {
        console.error(`[DOCX Loader] Error loading document:`, error);
        setEditorContent(`<p>Error loading document: ${String(error)}</p>`);
      } finally {
        setLoading(false);
      }
    },
    [getDocumentJSON, documentsById, setCurrentDocId, setLoading]
  );

  // Auto-open first document on mount
  useEffect(() => {
    if (!currentDocId) {
      loadDocument(DOCS[0].id);
    }
  }, [currentDocId, loadDocument]);

  const handleContentChange = (newContent: JSONContent) => {
    setEditorContent(newContent);
    // Optionally auto-save immediately on change? Or wait for interval.
    // Interval is safer for performance.
  };

  const handleDocumentSelect = (docId: string) => {
    // Save current document before switching
    if (currentDocId && activeEditorRef) {
      saveDocumentJSON(currentDocId, activeEditorRef.getJSON());
    }

    if (docId !== currentDocId) {
      loadDocument(docId);
    }
  };

  const handleSaveDraft = () => {
    if (currentDocId && activeEditorRef) {
      saveDocumentJSON(currentDocId, activeEditorRef.getJSON());
    }
    saveDraft(caseId);
  };

  const handleInsertAttachment = (attachmentId: string) => {
    if (!currentDocId) {
      alert("Please open a document first.");
      return;
    }

    if (!activeEditorRef) {
      console.error("Editor not initialized");
      return;
    }

    const attachment = attachmentsById[attachmentId];
    if (!attachment) return;

    // Insert AttachmentBlock at cursor
    activeEditorRef.chain().focus().insertContent({
      type: 'attachmentBlock',
      attrs: {
        attachmentId: attachment.id,
        name: attachment.name,
        url: attachment.url,
        mimeType: attachment.type,
        size: attachment.size,
        uploadedAt: attachment.uploadedAt,
      },
    }).run();
  };

  const handleDownload = () => {
    setIsDownloadModalOpen(true);
  };

  const handleAddAttachment = () => {
    attachmentInputRef.current?.click();
  };

  const handleAddDocument = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileType = file.type;
    const fileName = file.name;

    // Check if it's a DOCX file
    if (
      fileType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      fileName.endsWith(".docx")
    ) {
      // Convert DOCX to HTML and add as document
      try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        const htmlContent = result.value;

        addUploadedDocument({
          title: fileName.replace(".docx", ""),
          type: "docx",
          content: htmlContent,
        });

        // Optionally switch to the newly uploaded document
        // You would need to handle this in the store
      } catch (error) {
        console.error("Error converting DOCX:", error);
        alert("Failed to convert DOCX file");
      }
    } else {
      // Add as attachment (PDF, image, etc.)
      const url = URL.createObjectURL(file);
      addAttachment({
        name: fileName,
        type: fileType,
        size: file.size,
        url: url,
      });
    }

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAttachmentUpload = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    addAttachment({
      name: file.name,
      type: file.type,
      size: file.size,
      url: url,
    });

    // Reset input
    if (attachmentInputRef.current) attachmentInputRef.current.value = "";
  };

  const currentDocTitle =
    DOCS.find((d) => d.id === currentDocId)?.title || "Document";

  return (
    <DashboardLayout
      brandTitle="LawFlow"
      brandSubtitle="Case Document Preparation"
      actions={[
        {
          label: "Notifications",
          icon: Bell,
          onClick: () => navigate({ to: "/Lawyer-dashboard" }),
          badge: 3,
        },
        {
          label: "Profile",
          icon: User,
          onClick: () => navigate({ to: "/lawyer-profile" }),
        },
        {
          label: "Logout",
          icon: LogOut,
          onClick: () => navigate({ to: "/login" }),
        },
      ]}
    >
      <div className="flex flex-col h-full bg-gray-50 -m-6">
        <TopActionBar
          onSaveDraft={handleSaveDraft}
          onDownload={handleDownload}
          onRequestSignatures={() => setIsSignaturePanelOpen(true)}
          signaturePendingCount={signaturePendingCount}
          onAddAttachment={handleAddAttachment}
          onAddDocument={handleAddDocument}
        />

        <div className="flex flex-1 overflow-hidden">
          <DocumentSidebar
            onDocumentSelect={handleDocumentSelect}
            onInsertAttachment={handleInsertAttachment}
          />
          <DocEditor
            content={editorContent}
            onContentChange={handleContentChange}
            isLoading={isLoading}
          />
        </div>

        <DownloadModal
          isOpen={isDownloadModalOpen}
          onClose={() => setIsDownloadModalOpen(false)}
          currentDocTitle={currentDocTitle}
          currentDocContent={activeEditorRef?.getHTML() || (typeof editorContent === 'string' ? editorContent : "")}
        />

        {/* Signature Request Panel */}
        {isSignaturePanelOpen && (
          <SignatureRequestPanel
            caseId={caseId || "default-case"}
            bundleItems={bundleItems}
            onClose={() => setIsSignaturePanelOpen(false)}
          />
        )}

        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".docx,.pdf,.jpg,.jpeg,.png"
          onChange={handleFileUpload}
          className="hidden"
        />
        <input
          ref={attachmentInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.docx"
          onChange={handleAttachmentUpload}
          className="hidden"
        />
      </div>
    </DashboardLayout>
  );
}
