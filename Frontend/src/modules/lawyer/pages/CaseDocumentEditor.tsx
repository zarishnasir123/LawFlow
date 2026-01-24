import { useEffect, useState, useCallback } from "react";
import * as mammoth from "mammoth";
import DocumentSidebar from "../components/documentEditor/DocumentSidebar";
import DocEditor from "../components/documentEditor/DocEditor";
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
  const {
    currentDocId,
    setCurrentDocId,
    saveDocumentContent,
    getDocumentContent,
    setLoading,
    isLoading,
  } = useDocumentEditorStore();

  const [editorContent, setEditorContent] = useState("");

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
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(doc.url, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          // If file doesn't exist, use placeholder content
          const placeholderContent = `
            <h1>${doc.id.toUpperCase()}</h1>
            <p><strong>Document Type:</strong> ${doc.url.split('/').pop()}</p>
            <p>📝 This is a placeholder. Please upload the actual DOCX file to: <code>${doc.url}</code></p>
            <hr />
            <h2>Sample Content</h2>
            <p>You can now edit this document using the formatting toolbar above.</p>
            <ul>
              <li>Click the <strong>B</strong> button to make text bold</li>
              <li>Click the <strong>I</strong> button for italic</li>
              <li>Use alignment buttons for formatting</li>
              <li>Click the table icon to insert a table</li>
            </ul>
          `;
          setEditorContent(placeholderContent);
          saveDocumentContent(docId, placeholderContent);
          setLoading(false);
          return;
        }

        const arrayBuffer = await response.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });

        const htmlContent = result.value;
        setEditorContent(htmlContent);
        saveDocumentContent(docId, htmlContent);
        setLoading(false);
      } catch (error) {
        console.error("Error loading document:", error);
        const errorContent = `
          <h1>Error Loading Document</h1>
          <p>⚠️ Could not load: ${doc.url}</p>
          <p>Please ensure the DOCX file exists in the public folder.</p>
          <hr />
          <p>For now, you can edit with this placeholder content.</p>
        `;
        setEditorContent(errorContent);
        saveDocumentContent(docId, errorContent);
      } finally {
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

  return (
    <div className="flex h-screen bg-gray-100">
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
  );
}
