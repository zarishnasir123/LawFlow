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
  lastSaved: string | null;
  isDirty: boolean;
  draftLoaded: boolean;

  // New Bundle System Fields
  bundleItems: BundleItem[];
  documentsById: Record<string, DocumentData>;
  attachmentsById: Record<string, Attachment>;
  activeEditorRef: Editor | null;        // Runtime only, never persisted

  // Existing methods
  setCurrentDocId: (docId: string | null) => void;
  saveDocumentContent: (docId: string, content: string) => void;
  getDocumentContent: (docId: string) => string | undefined;
  setLoading: (loading: boolean) => void;
  hasContent: (docId: string) => boolean;

  // Existing attachment/upload methods. Optional id lets the caller
  // pass the backend's UUID so the in-store id matches the
  // case_attachments row — required for the refresh-on-restore flow
  // that re-mints signed URLs by attachment id.
  addAttachment: (
    attachment: Omit<Attachment, "id" | "uploadedAt"> & { id?: string }
  ) => void;
  // Reconcile the in-store attachment list with the backend's
  // authoritative list. Drops any ATTACHMENT bundle item whose refId
  // is no longer on the server (cleans up stale localStorage rows
  // from before persistence existed) and ensures every server row
  // has a bundle entry with a fresh URL. Idempotent — safe to call
  // on every case open.
  reconcileAttachmentsFromBackend: (
    serverAttachments: Array<Omit<Attachment, "uploadedAt"> & { uploadedAt?: string }>
  ) => void;
  removeAttachment: (id: string) => void;
  saveDraft: (caseId?: string) => void;
  loadDraft: (caseId?: string) => void;
  clearDraft: (caseId?: string) => void;
  setDirty: (dirty: boolean) => void;
  // Marks the document as saved: stamps lastSaved=now and clears isDirty.
  // Used by the editor's backend autosave (persistEditedHtml), which writes
  // edited_html outside the localStorage-draft path that saveDraft owns, so
  // the "Last edited" header still needs a way to reflect those saves.
  markSaved: () => void;

  // New Bundle System Methods
  setEditorRef: (editor: Editor | null) => void;
  reorderBundleItems: (items: BundleItem[]) => void;
  addDocumentToBundle: (doc: DocumentData) => void;
  addAttachmentToBundle: (attachmentId: string) => void;
  addSignedAttachment: (
    attachment: Omit<Attachment, "id" | "uploadedAt">,
    insertAfterBundleItemId?: string
  ) => string;
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
  lastSaved: null,
  isDirty: false,
  draftLoaded: false,

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
      // Use the caller-supplied id (backend UUID) when present.
      // Falls back to the legacy local id for purely-local flows.
      id: attachment.id ?? `att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      uploadedAt: new Date().toISOString(),
    };

    set((state) => {
      // Dedup by id. The mount-time hydration from listAttachments
      // calls addAttachment once per persisted row; without this
      // check, each page refresh would keep adding more sidebar
      // rows for the same backend attachment because the previous
      // session's bundleItems (restored from localStorage) already
      // contain a row for it. We update the URL + metadata in
      // place so a freshly signed URL replaces a stale one.
      if (state.attachmentsById[newAttachment.id]) {
        const merged: Attachment = {
          ...state.attachmentsById[newAttachment.id],
          ...newAttachment,
          // Preserve the original uploadedAt so the sidebar's sort
          // order doesn't shuffle on every refresh.
          uploadedAt:
            state.attachmentsById[newAttachment.id].uploadedAt ||
            newAttachment.uploadedAt,
        };
        return {
          attachments: state.attachments.map((a) =>
            a.id === merged.id ? merged : a
          ),
          attachmentsById: {
            ...state.attachmentsById,
            [merged.id]: merged,
          },
          // bundleItems untouched — the existing row already points
          // to this attachment refId.
        };
      }

      const bundleItem: BundleItem = {
        id: `bundle_att_${newAttachment.id}`,
        type: "ATTACHMENT",
        refId: newAttachment.id,
        title: newAttachment.name,
        createdAt: newAttachment.uploadedAt,
      };

      const items = [...state.bundleItems];
      let insertIndex = -1;

      // Try to insert after currently selected document
      if (state.currentDocId) {
        const currentIndex = items.findIndex(
          (item) => item.refId === state.currentDocId
        );
        if (currentIndex !== -1) {
          insertIndex = currentIndex + 1;
        }
      }

      // Fallback: Add to end
      if (insertIndex === -1) {
        insertIndex = items.length;
      }

      items.splice(insertIndex, 0, bundleItem);

      return {
        attachments: [...state.attachments, newAttachment],
        attachmentsById: {
          ...state.attachmentsById,
          [newAttachment.id]: newAttachment,
        },
        bundleItems: items,
        isDirty: true,
      };
    });
  },

  reconcileAttachmentsFromBackend: (serverAttachments) => {
    // Backend is the source of truth. Build the new attachmentsById
    // map from scratch, preserving the in-memory `uploadedAt` when
    // we already had the row (avoids the sidebar shuffling on every
    // refresh due to a server timestamp tick).
    set((state) => {
      const nextById: Record<string, Attachment> = {};
      const nextArray: Attachment[] = [];

      for (const incoming of serverAttachments) {
        const previous = state.attachmentsById[incoming.id];
        const merged: Attachment = {
          id: incoming.id,
          name: incoming.name,
          type: incoming.type,
          size: incoming.size,
          url: incoming.url,
          uploadedAt:
            previous?.uploadedAt ||
            incoming.uploadedAt ||
            new Date().toISOString(),
        };
        nextById[merged.id] = merged;
        nextArray.push(merged);
      }

      // Walk the existing bundleItems and drop ATTACHMENT entries
      // whose refId isn't in the server list (stale localStorage
      // duplicates from before persistence shipped). DOC items pass
      // through untouched.
      const filtered = state.bundleItems.filter(
        (item) => item.type !== "ATTACHMENT" || Boolean(nextById[item.refId])
      );

      // Dedup ATTACHMENT items just in case localStorage had two
      // bundle entries for the same refId. Keeps the first occurrence
      // so the user's chosen ordering survives.
      const seen = new Set<string>();
      const deduped = filtered.filter((item) => {
        if (item.type !== "ATTACHMENT") return true;
        if (seen.has(item.refId)) return false;
        seen.add(item.refId);
        return true;
      });

      // Append a bundle entry for any server attachment we don't
      // yet have one for (first-time mount after a fresh upload
      // happened in another tab, for instance).
      const haveRefIds = new Set(
        deduped
          .filter((item) => item.type === "ATTACHMENT")
          .map((item) => item.refId)
      );
      const additions: BundleItem[] = [];
      for (const att of nextArray) {
        if (haveRefIds.has(att.id)) continue;
        additions.push({
          id: `bundle_att_${att.id}`,
          type: "ATTACHMENT",
          refId: att.id,
          title: att.name,
          createdAt: att.uploadedAt,
        });
      }

      return {
        attachments: nextArray,
        attachmentsById: nextById,
        bundleItems: [...deduped, ...additions],
      };
    });
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

  initializeDefaultBundle: (
    defaultDocs: ReadonlyArray<{ id: string; title: string; url?: string }>
  ) => {
    const state = get();
    if (state.bundleItems.length > 0 || state.draftLoaded) {
      return;
    }

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

  saveDraft: (caseId?: string) => {
    const state = get();
    const storageKey = caseId ? `${STORAGE_KEY}_${caseId}` : STORAGE_KEY;

    const draft = {
      version: 2,  // Versioning for migration
      currentDocId: state.currentDocId,
      documentContents: state.documentContents,  // Keep for backward compat
      attachments: state.attachments,  // Keep for backward compat
      // New bundle system fields
      bundleItems: state.bundleItems,
      documentsById: state.documentsById,
      attachmentsById: state.attachmentsById,
      // NOTE: activeEditorRef is NOT persisted (runtime only)
      lastSaved: new Date().toISOString(),
    };

    try {
      localStorage.setItem(storageKey, JSON.stringify(draft));
      set({ lastSaved: draft.lastSaved, isDirty: false, draftLoaded: true });
    } catch (error) {
      console.error(`[Draft] Failed to save to ${storageKey}:`, error);
    }
  },

  loadDraft: (caseId?: string) => {
    try {
      const storageKey = caseId ? `${STORAGE_KEY}_${caseId}` : STORAGE_KEY;
      const saved = localStorage.getItem(storageKey);

      if (!saved) {
        // No draft for this case yet — initializeDefaultBundle will
        // seed the templates on the next call.
        return;
      }

      const draft = JSON.parse(saved);

      // Migration: v1 (old) to v2 (new bundle system)
      if (!draft.version || draft.version === 1) {

        const migratedState = {
          currentDocId: draft.currentDocId,
          documentContents: draft.documentContents || {},
          attachments: draft.attachments || [],
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

        // Symmetric guard with the v2 path below: if a v1 migration
        // produces an empty bundle (no docs, no attachments), don't
        // flip draftLoaded — let initializeDefaultBundle seed the
        // template instead. Otherwise the editor would be locked in
        // "no documents" mode forever for any old empty draft.
        if (
          migratedState.bundleItems.length === 0 &&
          migratedState.attachments.length === 0
        ) {
          set({ draftLoaded: false });
        } else {
          set({
            ...migratedState,
            draftLoaded: true,
          });
        }
      } else {
        const draftBundleItems = (draft.bundleItems || []) as BundleItem[];
        const draftDocumentsById = (draft.documentsById || {}) as Record<string, DocumentData>;
        const draftDocumentContents = (draft.documentContents || {}) as DocumentContent;

        const isTrulyEmptyDraft =
          draftBundleItems.length === 0 &&
          (!draft.attachments || draft.attachments.length === 0);

        if (isTrulyEmptyDraft) {
          set({ draftLoaded: false });
          return;
        }

        // Drafts now restore verbatim — the old custom-bundle /
        // template-stripping path went away when the DOCX upload
        // feature was removed.
        set({
          currentDocId: draft.currentDocId,
          documentContents: draftDocumentContents,
          attachments: draft.attachments || [],
          bundleItems: draftBundleItems,
          documentsById: draftDocumentsById,
          attachmentsById: draft.attachmentsById || {},
          activeEditorRef: null,  // Never persisted
          lastSaved: draft.lastSaved,
          isDirty: false,
          draftLoaded: true,
        });
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
        bundleItems: [],
        documentsById: {},
        attachmentsById: {},
        activeEditorRef: null,
        lastSaved: null,
        isDirty: false,
        draftLoaded: false,
      });
    } catch (error) {
      console.error("[Draft] Failed to clear:", error);
    }
  },

  setDirty: (dirty) => set({ isDirty: dirty }),

  markSaved: () => set({ lastSaved: new Date().toISOString(), isDirty: false }),

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

  addSignedAttachment: (attachment, insertAfterBundleItemId) => {
    const newAttachment: Attachment = {
      ...attachment,
      id: `att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      uploadedAt: new Date().toISOString(),
    };

    const bundleItem: BundleItem = {
      id: `bundle_att_${newAttachment.id}`,
      type: 'ATTACHMENT',
      refId: newAttachment.id,
      title: newAttachment.name,
      createdAt: newAttachment.uploadedAt,
    };

    set((state) => {
      const items = [...state.bundleItems];
      let insertIndex = items.length;

      if (insertAfterBundleItemId) {
        const currentIndex = items.findIndex(
          (item) => item.id === insertAfterBundleItemId
        );
        if (currentIndex !== -1) {
          insertIndex = currentIndex + 1;
        }
      }

      items.splice(insertIndex, 0, bundleItem);

      return {
        attachments: [...state.attachments, newAttachment],
        attachmentsById: {
          ...state.attachmentsById,
          [newAttachment.id]: newAttachment,
        },
        bundleItems: items,
        isDirty: true,
      };
    });

    return newAttachment.id;
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
