import { create } from "zustand";

const STORAGE_KEY = "lawyer_case_draft";

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  uploadedAt: string;
}

export interface UploadedDocument {
  id: string;
  title: string;
  type: "docx" | "pdf" | "image";
  content?: string;
  url?: string;
  uploadedAt: string;
}

interface DocumentContent {
  [docId: string]: string;
}

interface DocumentEditorState {
  currentDocId: string | null;
  documentContents: DocumentContent;
  isLoading: boolean;
  attachments: Attachment[];
  uploadedDocuments: UploadedDocument[];
  lastSaved: string | null;
  isDirty: boolean;

  // Existing methods
  setCurrentDocId: (docId: string) => void;
  saveDocumentContent: (docId: string, content: string) => void;
  getDocumentContent: (docId: string) => string | undefined;
  setLoading: (loading: boolean) => void;
  hasContent: (docId: string) => boolean;

  // New methods
  addAttachment: (attachment: Omit<Attachment, "id" | "uploadedAt">) => void;
  removeAttachment: (id: string) => void;
  addUploadedDocument: (doc: Omit<UploadedDocument, "id" | "uploadedAt">) => void;
  removeUploadedDocument: (id: string) => void;
  saveDraft: () => void;
  loadDraft: () => void;
  clearDraft: () => void;
  setDirty: (dirty: boolean) => void;
}

export const useDocumentEditorStore = create<DocumentEditorState>((set, get) => ({
  currentDocId: null,
  documentContents: {},
  isLoading: false,
  attachments: [],
  uploadedDocuments: [],
  lastSaved: null,
  isDirty: false,

  setCurrentDocId: (docId) => set({ currentDocId: docId }),

  saveDocumentContent: (docId, content) => {
    set((state) => ({
      documentContents: {
        ...state.documentContents,
        [docId]: content,
      },
      isDirty: true,
    }));
  },

  getDocumentContent: (docId) => get().documentContents[docId],

  setLoading: (loading) => set({ isLoading: loading }),

  hasContent: (docId) => docId in get().documentContents,

  addAttachment: (attachment) => {
    const newAttachment: Attachment = {
      ...attachment,
      id: `att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      uploadedAt: new Date().toISOString(),
    };
    set((state) => ({
      attachments: [...state.attachments, newAttachment],
      isDirty: true,
    }));
  },

  removeAttachment: (id) => {
    const state = get();
    const attachment = state.attachments.find((a) => a.id === id);
    if (attachment?.url) {
      URL.revokeObjectURL(attachment.url);
    }
    set((state) => ({
      attachments: state.attachments.filter((a) => a.id !== id),
      isDirty: true,
    }));
  },

  addUploadedDocument: (doc) => {
    const newDoc: UploadedDocument = {
      ...doc,
      id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      uploadedAt: new Date().toISOString(),
    };
    set((state) => ({
      uploadedDocuments: [...state.uploadedDocuments, newDoc],
      isDirty: true,
    }));
  },

  removeUploadedDocument: (id) => {
    const state = get();
    const doc = state.uploadedDocuments.find((d) => d.id === id);
    if (doc?.url) {
      URL.revokeObjectURL(doc.url);
    }
    set((state) => ({
      uploadedDocuments: state.uploadedDocuments.filter((d) => d.id !== id),
      isDirty: true,
    }));
  },

  saveDraft: () => {
    const state = get();
    const draft = {
      currentDocId: state.currentDocId,
      documentContents: state.documentContents,
      attachments: state.attachments,
      uploadedDocuments: state.uploadedDocuments,
      lastSaved: new Date().toISOString(),
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
      set({ lastSaved: draft.lastSaved, isDirty: false });
      console.log("[Draft] Saved successfully at", draft.lastSaved);
    } catch (error) {
      console.error("[Draft] Failed to save:", error);
    }
  },

  loadDraft: () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        set({
          currentDocId: draft.currentDocId,
          documentContents: draft.documentContents || {},
          attachments: draft.attachments || [],
          uploadedDocuments: draft.uploadedDocuments || [],
          lastSaved: draft.lastSaved,
          isDirty: false,
        });
        console.log("[Draft] Loaded successfully from", draft.lastSaved);
      }
    } catch (error) {
      console.error("[Draft] Failed to load:", error);
    }
  },

  clearDraft: () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      set({
        currentDocId: null,
        documentContents: {},
        attachments: [],
        uploadedDocuments: [],
        lastSaved: null,
        isDirty: false,
      });
      console.log("[Draft] Cleared successfully");
    } catch (error) {
      console.error("[Draft] Failed to clear:", error);
    }
  },

  setDirty: (dirty) => set({ isDirty: dirty }),
}));
