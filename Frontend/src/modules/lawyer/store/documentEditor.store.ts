import { create } from "zustand";
import type { Editor, JSONContent } from "@tiptap/react";

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

// New Bundle System Types
export type BundleItemType = "DOC" | "ATTACHMENT";

export interface BundleItem {
  id: string;              // Unique bundle entry ID
  type: BundleItemType;
  refId: string;           // docId if DOC, attachmentId if ATTACHMENT
  title: string;
  createdAt: string;
  // NOTE: Array index IS the order - no separate field needed
}

export interface DocumentData {
  id: string;
  title: string;
  contentJSON: JSONContent | null;        // TipTap JSON content (instead of HTML)
  legacyHtml?: string;     // For migration: old HTML content (converted lazily)
  isTemplate: boolean;
  url?: string;            // For templates
}

interface DocumentContent {
  [docId: string]: string;
}

interface DocumentEditorState {
  currentDocId: string | null;
  documentContents: DocumentContent;  // Legacy: will be deprecated
  isLoading: boolean;
  attachments: Attachment[];          // Legacy: will move to attachmentsById
  uploadedDocuments: UploadedDocument[];
  lastSaved: string | null;
  isDirty: boolean;

  // New Bundle System Fields
  bundleItems: BundleItem[];
  documentsById: Record<string, DocumentData>;
  attachmentsById: Record<string, Attachment>;
  activeEditorRef: Editor | null;        // Runtime only, never persisted

  // Existing methods
  setCurrentDocId: (docId: string) => void;
  saveDocumentContent: (docId: string, content: string) => void;
  getDocumentContent: (docId: string) => string | undefined;
  setLoading: (loading: boolean) => void;
  hasContent: (docId: string) => boolean;

  // Existing attachment/upload methods
  addAttachment: (attachment: Omit<Attachment, "id" | "uploadedAt">) => void;
  removeAttachment: (id: string) => void;
  addUploadedDocument: (doc: Omit<UploadedDocument, "id" | "uploadedAt">) => void;
  removeUploadedDocument: (id: string) => void;
  saveDraft: (caseId?: string) => void;
  loadDraft: (caseId?: string) => void;
  clearDraft: (caseId?: string) => void;
  setDirty: (dirty: boolean) => void;

  // New Bundle System Methods
  setEditorRef: (editor: Editor | null) => void;
  reorderBundleItems: (items: BundleItem[]) => void;
  addDocumentToBundle: (doc: DocumentData) => void;
  addAttachmentToBundle: (attachmentId: string) => void;
  removeFromBundle: (bundleItemId: string) => void;
  saveDocumentJSON: (docId: string, json: JSONContent) => void;
  getDocumentJSON: (docId: string) => JSONContent | null | undefined;
  initializeDefaultBundle: (
    defaultDocs: ReadonlyArray<{ id: string; title: string; url?: string }>
  ) => void;
}

export const useDocumentEditorStore = create<DocumentEditorState>((set, get) => ({
  currentDocId: null,
  documentContents: {},
  isLoading: false,
  attachments: [],
  uploadedDocuments: [],
  lastSaved: null,
  isDirty: false,

  // New Bundle System Fields (initialized)
  bundleItems: [],
  documentsById: {},
  attachmentsById: {},
  activeEditorRef: null,

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

    // Create bundle item for this attachment
    const bundleItem: BundleItem = {
      id: `bundle_att_${newAttachment.id}`,
      type: 'ATTACHMENT',
      refId: newAttachment.id,
      title: newAttachment.name,
      createdAt: newAttachment.uploadedAt,
    };

    set((state) => ({
      attachments: [...state.attachments, newAttachment],
      attachmentsById: {
        ...state.attachmentsById,
        [newAttachment.id]: newAttachment,
      },
      bundleItems: (() => {
        const items = [...state.bundleItems];
        let insertIndex = -1;

        // Try to insert after currently selected document
        if (state.currentDocId) {
          const currentIndex = items.findIndex(item => item.refId === state.currentDocId);
          if (currentIndex !== -1) {
            insertIndex = currentIndex + 1;
          }
        }

        // Fallback: Add to end
        if (insertIndex === -1) {
          insertIndex = items.length;
        }

        items.splice(insertIndex, 0, bundleItem);
        return items;
      })(),
      isDirty: true,
    }));
  },

  removeAttachment: (id) => {
    const state = get();
    const attachment = state.attachments.find((a) => a.id === id);
    if (attachment?.url) {
      URL.revokeObjectURL(attachment.url);
    }

    // Also remove from attachmentsById and bundleItems
    const attachmentsById = { ...state.attachmentsById };
    delete attachmentsById[id];

    const bundleItems = state.bundleItems.filter(
      item => !(item.type === 'ATTACHMENT' && item.refId === id)
    );

    set((state) => ({
      attachments: state.attachments.filter((a) => a.id !== id),
      attachmentsById,
      bundleItems,
      isDirty: true,
    }));
  },

  addUploadedDocument: (doc) => {
    const newDoc: UploadedDocument = {
      ...doc,
      id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      uploadedAt: new Date().toISOString(),
    };

    // Create bundle item
    const bundleItem: BundleItem = {
      id: `bundle_doc_${newDoc.id}`,
      type: 'DOC',
      refId: newDoc.id,
      title: newDoc.title,
      createdAt: newDoc.uploadedAt,
    };

    // Add to documentsById for new system
    const docData: DocumentData = {
      id: newDoc.id,
      title: newDoc.title,
      contentJSON: null, // Will be set when opened (or passed content converted)
      legacyHtml: newDoc.content, // Store content initially as legacy/raw
      isTemplate: false,
    };

    set((state) => ({
      uploadedDocuments: [...state.uploadedDocuments, newDoc],
      documentsById: {
        ...state.documentsById,
        [newDoc.id]: docData
      },
      // Insert after currently selected document or last DOC
      bundleItems: (() => {
        const items = [...state.bundleItems];
        let insertIndex = -1;

        // 1. Try to insert after currently selected document
        if (state.currentDocId) {
          const currentIndex = items.findIndex(item => item.refId === state.currentDocId);
          if (currentIndex !== -1) {
            insertIndex = currentIndex + 1;
          }
        }

        // 2. Fallback: Insert after last DOC
        if (insertIndex === -1) {
          let lastDocIndex = -1;
          for (let i = items.length - 1; i >= 0; i--) {
            if (items[i].type === 'DOC') {
              lastDocIndex = i;
              break;
            }
          }
          insertIndex = lastDocIndex >= 0 ? lastDocIndex + 1 : 0;
        }

        items.splice(insertIndex, 0, bundleItem);
        return items;
      })(),
      isDirty: true,
    }));
  },

  initializeDefaultBundle: (
    defaultDocs: ReadonlyArray<{ id: string; title: string; url?: string }>
  ) => {
    const state = get();
    if (state.bundleItems.length > 0) return; // Already initialized

    const bundleItems: BundleItem[] = defaultDocs.map(doc => ({
      id: `bundle_doc_${doc.id}`,
      type: 'DOC',
      refId: doc.id,
      title: doc.title,
      createdAt: new Date().toISOString(),
    }));

    const documentsById: Record<string, DocumentData> = {};
    defaultDocs.forEach(doc => {
      documentsById[doc.id] = {
        id: doc.id,
        title: doc.title,
        contentJSON: null,
        isTemplate: true,
        url: doc.url,
      };
    });

    set({ bundleItems, documentsById });
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

  saveDraft: (caseId?: string) => {
    const state = get();
    const storageKey = caseId ? `${STORAGE_KEY}_${caseId}` : STORAGE_KEY;

    const draft = {
      version: 2,  // Versioning for migration
      currentDocId: state.currentDocId,
      documentContents: state.documentContents,  // Keep for backward compat
      attachments: state.attachments,  // Keep for backward compat
      uploadedDocuments: state.uploadedDocuments,
      // New bundle system fields
      bundleItems: state.bundleItems,
      documentsById: state.documentsById,
      attachmentsById: state.attachmentsById,
      // NOTE: activeEditorRef is NOT persisted (runtime only)
      lastSaved: new Date().toISOString(),
    };

    try {
      localStorage.setItem(storageKey, JSON.stringify(draft));
      set({ lastSaved: draft.lastSaved, isDirty: false });
      console.log(`[Draft] Saved successfully to ${storageKey} at`, draft.lastSaved);
    } catch (error) {
      console.error(`[Draft] Failed to save to ${storageKey}:`, error);
    }
  },

  loadDraft: (caseId?: string) => {
    try {
      const storageKey = caseId ? `${STORAGE_KEY}_${caseId}` : STORAGE_KEY;
      const saved = localStorage.getItem(storageKey);

      if (!saved) {
        console.log(`[Draft] No draft found for ${storageKey}`);
        // Reset state to empty/clean if loading a new case (but preserve global loading state?)
        // Actually, clearer to reset explicitly if we switched contexts.
        // But for now, if no draft, we keep default initialized state (which might be populated by initializeDefaultBundle later)
        return;
      }

      const draft = JSON.parse(saved);

      // Migration: v1 (old) to v2 (new bundle system)
      if (!draft.version || draft.version === 1) {
        console.log("[Draft] Migrating from v1 to v2...");

        const migratedState = {
          currentDocId: draft.currentDocId,
          documentContents: draft.documentContents || {},
          attachments: draft.attachments || [],
          uploadedDocuments: draft.uploadedDocuments || [],
          lastSaved: draft.lastSaved,
          isDirty: false,
          // Build bundleItems (array index = order)
          bundleItems: [] as BundleItem[],
          documentsById: {} as Record<string, DocumentData>,
          attachmentsById: {} as Record<string, Attachment>,
          activeEditorRef: null,
        };

        // Migrate attachments to attachmentsById
        (draft.attachments || []).forEach((att: Attachment) => {
          migratedState.attachmentsById[att.id] = att;
          migratedState.bundleItems.push({
            id: `bundle_att_${att.id}`,
            type: 'ATTACHMENT',
            refId: att.id,
            title: att.name,
            createdAt: att.uploadedAt,
          });
        });

        // Migrate documentContents to documentsById (with legacyHtml)
        Object.entries(draft.documentContents || {}).forEach((entry) => {
          const [docId, html] = entry as [string, unknown];
          const legacyHtml = typeof html === "string" ? html : String(html ?? "");
          migratedState.documentsById[docId] = {
            id: docId,
            title: docId,  // Will be updated when we know the title
            contentJSON: null,  // Will convert when document is opened
            legacyHtml,  // Keep original HTML for conversion
            isTemplate: true,
          };
        });

        set(migratedState);
        console.log("[Draft] Migration complete");
      } else {
        // v2 draft - load directly
        set({
          currentDocId: draft.currentDocId,
          documentContents: draft.documentContents || {},
          attachments: draft.attachments || [],
          uploadedDocuments: draft.uploadedDocuments || [],
          bundleItems: draft.bundleItems || [],
          documentsById: draft.documentsById || {},
          attachmentsById: draft.attachmentsById || {},
          activeEditorRef: null,  // Never persisted
          lastSaved: draft.lastSaved,
          isDirty: false,
        });
        console.log(`[Draft] Loaded successfully from ${storageKey} (${draft.lastSaved})`);
      }
    } catch (error) {
      console.error("[Draft] Failed to load:", error);
    }
  },

  clearDraft: (caseId?: string) => {
    try {
      const storageKey = caseId ? `${STORAGE_KEY}_${caseId}` : STORAGE_KEY;
      localStorage.removeItem(storageKey);
      set({
        currentDocId: null,
        documentContents: {},
        attachments: [],
        uploadedDocuments: [],
        bundleItems: [],
        documentsById: {},
        attachmentsById: {},
        activeEditorRef: null,
        lastSaved: null,
        isDirty: false,
      });
      console.log(`[Draft] Cleared successfully (${storageKey})`);
    } catch (error) {
      console.error("[Draft] Failed to clear:", error);
    }
  },

  setDirty: (dirty) => set({ isDirty: dirty }),

  // New Bundle System Methods
  setEditorRef: (editor) => set({ activeEditorRef: editor }),

  reorderBundleItems: (items) => {
    set({ bundleItems: items, isDirty: true });
  },

  addDocumentToBundle: (doc) => {
    const state = get();

    // Add to documentsById
    const documentsById = {
      ...state.documentsById,
      [doc.id]: doc,
    };

    // Add to bundleItems (at the end, before attachments)
    // Find last DOC index using backwards iteration
    let lastDocIndex = -1;
    for (let i = state.bundleItems.length - 1; i >= 0; i--) {
      if (state.bundleItems[i].type === 'DOC') {
        lastDocIndex = i;
        break;
      }
    }
    const insertIndex = lastDocIndex >= 0 ? lastDocIndex + 1 : 0;

    const bundleItem: BundleItem = {
      id: `bundle_doc_${doc.id}`,
      type: 'DOC',
      refId: doc.id,
      title: doc.title,
      createdAt: new Date().toISOString(),
    };

    const bundleItems = [...state.bundleItems];
    bundleItems.splice(insertIndex, 0, bundleItem);

    set({ documentsById, bundleItems, isDirty: true });
  },

  addAttachmentToBundle: (attachmentId) => {
    const state = get();
    const attachment = state.attachmentsById[attachmentId];
    if (!attachment) return;

    // Check if already in bundle
    const existsInBundle = state.bundleItems.some(
      item => item.type === 'ATTACHMENT' && item.refId === attachmentId
    );
    if (existsInBundle) return;

    const bundleItem: BundleItem = {
      id: `bundle_att_${attachmentId}`,
      type: 'ATTACHMENT',
      refId: attachmentId,
      title: attachment.name,
      createdAt: new Date().toISOString(),
    };

    set({
      bundleItems: [...state.bundleItems, bundleItem],
      isDirty: true,
    });
  },

  removeFromBundle: (bundleItemId) => {
    const state = get();
    const bundleItems = state.bundleItems.filter(item => item.id !== bundleItemId);
    set({ bundleItems, isDirty: true });
  },

  saveDocumentJSON: (docId, json) => {
    const state = get();
    const existing = state.documentsById[docId];

    set({
      documentsById: {
        ...state.documentsById,
        [docId]: {
          ...existing,
          id: docId,
          title: existing?.title || docId,
          contentJSON: json,
          isTemplate: existing?.isTemplate ?? true,
          legacyHtml: undefined, // Clear legacy HTML after conversion
        },
      },
      isDirty: true,
    });
  },

  getDocumentJSON: (docId) => {
    return get().documentsById[docId]?.contentJSON;
  },
}));
