import { create } from "zustand";

interface DocumentContent {
  [docId: string]: string;
}

interface DocumentEditorState {
  currentDocId: string | null;
  documentContents: DocumentContent;
  isLoading: boolean;
  setCurrentDocId: (docId: string) => void;
  saveDocumentContent: (docId: string, content: string) => void;
  getDocumentContent: (docId: string) => string | undefined;
  setLoading: (loading: boolean) => void;
  hasContent: (docId: string) => boolean;
}

export const useDocumentEditorStore = create<DocumentEditorState>((set, get) => ({
  currentDocId: null,
  documentContents: {},
  isLoading: false,

  setCurrentDocId: (docId) => set({ currentDocId: docId }),

  saveDocumentContent: (docId, content) =>
    set((state) => ({
      documentContents: {
        ...state.documentContents,
        [docId]: content,
      },
    })),

  getDocumentContent: (docId) => get().documentContents[docId],

  setLoading: (loading) => set({ isLoading: loading }),

  hasContent: (docId) => docId in get().documentContents,
}));
