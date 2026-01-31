import { create } from "zustand";

interface PageTitleStore {
  title: string;
  subtitle: string;
  setPageTitle: (title: string, subtitle: string) => void;
}

export const usePageTitleStore = create<PageTitleStore>((set) => ({
  title: "LawFlow",
  subtitle: "Lawyer Portal",
  setPageTitle: (title: string, subtitle: string) =>
    set({ title, subtitle }),
}));

export function usePageTitle(title: string, subtitle: string) {
  usePageTitleStore.setState({ title, subtitle });
  
  const cleanup = () => {
    usePageTitleStore.setState({ title: "LawFlow", subtitle: "Lawyer Portal" });
  };

  return cleanup;
}
