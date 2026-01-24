import { useEffect, useState, useCallback, useRef } from "react";
import * as mammoth from "mammoth";
import { Bell, LogOut, User } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import DashboardLayout from "../../../shared/components/dashboard/DashboardLayout";
import DocumentSidebar from "../components/documentEditor/DocumentSidebar";
import DocEditor from "../components/documentEditor/DocEditor";
import TopActionBar from "../components/documentEditor/TopActionBar";
import DownloadModal from "../components/documentEditor/DownloadModal";
import { useDocumentEditorStore } from "../store/documentEditor.store";

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
  const {
    currentDocId,
    setCurrentDocId,
    saveDocumentContent,
    getDocumentContent,
    setLoading,
    isLoading,
    saveDraft,
    loadDraft,
    addAttachment,
    addUploadedDocument,
  } = useDocumentEditorStore();

  const [editorContent, setEditorContent] = useState("");
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  // Load draft on mount
  useEffect(() => {
    loadDraft();
  }, [loadDraft]);

  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (currentDocId && editorContent) {
        saveDocumentContent(currentDocId, editorContent);
        saveDraft();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [currentDocId, editorContent, saveDocumentContent, saveDraft]);

  const loadDocument = useCallback(
    async (docId: string) => {
      // Check if content is cached first
      const cachedContent = getDocumentContent(docId);
      if (cachedContent) {
        setCurrentDocId(docId);
        setEditorContent(cachedContent);
        return;
      }

      // Load from DOCX
      const doc = DOCS.find((d) => d.id === docId);
      if (!doc) return;

      setCurrentDocId(docId);
      setLoading(true);

      try {
        console.log(`[DOCX Loader] Loading document: ${doc.title}`);
        console.log(`[DOCX Loader] URL: ${doc.url}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(doc.url, { signal: controller.signal });
        clearTimeout(timeoutId);

        console.log(`[DOCX Loader] Fetch response status: ${response.status}`);

        if (!response.ok) {
          console.error(
            `[DOCX Loader] Failed to fetch: ${response.status} ${response.statusText}`
          );
          const placeholderContent = `
            <h1>${doc.title.toUpperCase()}</h1>
            <p><strong>Document Type:</strong> ${doc.url.split("/").pop()}</p>
            <p>📝 Failed to load document (${response.status
            }). Please ensure the DOCX file exists at: <code>${doc.url
            }</code></p>
            <hr />
            <h2>Sample Content</h2>
            <p>You can now edit this document using the formatting toolbar above.</p>
          `;
          setEditorContent(placeholderContent);
          saveDocumentContent(docId, placeholderContent);
          return;
        }

        const arrayBuffer = await response.arrayBuffer();
        console.log(
          `[DOCX Loader] ArrayBuffer size: ${arrayBuffer.byteLength} bytes`
        );

        const result = await mammoth.convertToHtml({ arrayBuffer });
        console.log(`[DOCX Loader] Mammoth conversion complete`);
        console.log(
          `[DOCX Loader] HTML content length: ${result.value.length} characters`
        );

        if (result.messages && result.messages.length > 0) {
          console.warn(`[DOCX Loader] Mammoth messages:`, result.messages);
        }

        const htmlContent = result.value;

        if (!htmlContent || htmlContent.trim().length === 0) {
          console.warn(`[DOCX Loader] Converted HTML is empty`);
          const emptyContent = `
            <h1>${doc.title}</h1>
            <p>⚠️ Document converted but appears to be empty.</p>
            <p>You can start editing here.</p>
          `;
          setEditorContent(emptyContent);
          saveDocumentContent(docId, emptyContent);
        } else {
          console.log(`[DOCX Loader] Successfully loaded document: ${doc.title}`);
          setEditorContent(htmlContent);
          saveDocumentContent(docId, htmlContent);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(`[DOCX Loader] Error loading document:`, error);

        let errorReason = "Unknown error";
        if (errorMessage.includes("aborted")) {
          errorReason = "Request timeout (5 seconds)";
        } else if (errorMessage.includes("Failed to fetch")) {
          errorReason = "Network error or file not found";
        }

        const errorContent = `
          <h1>Error Loading Document</h1>
          <p>⚠️ Could not load: ${doc.url}</p>
          <p><strong>Reason:</strong> ${errorReason}</p>
          <p>Please ensure the DOCX file exists in the public folder.</p>
          <hr />
          <p>For now, you can edit with this placeholder content.</p>
        `;
        setEditorContent(errorContent);
        saveDocumentContent(docId, errorContent);
      } finally {
        console.log(`[DOCX Loader] Loading complete, setting loading to false`);
        setLoading(false);
      }
    },
    [saveDocumentContent, getDocumentContent, setCurrentDocId, setLoading]
  );

  // Auto-open first document on mount
  useEffect(() => {
    if (!currentDocId) {
      loadDocument(DOCS[0].id);
    }
  }, [currentDocId, loadDocument]);

  const handleContentChange = (newContent: string) => {
    setEditorContent(newContent);
  };

  const handleDocumentSelect = (docId: string) => {
    // Save current document before switching
    if (currentDocId && editorContent) {
      saveDocumentContent(currentDocId, editorContent);
    }

    if (docId !== currentDocId) {
      loadDocument(docId);
    }
  };

  const handleSaveDraft = () => {
    if (currentDocId && editorContent) {
      saveDocumentContent(currentDocId, editorContent);
    }
    saveDraft();
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
      brandSubtitle="Lawyer Portal"
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
          onAddAttachment={handleAddAttachment}
          onAddDocument={handleAddDocument}
        />

        <div className="flex flex-1 overflow-hidden">
          <DocumentSidebar
            documents={DOCS}
            onDocumentSelect={handleDocumentSelect}
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
          currentDocContent={editorContent}
        />

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
