"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type PreviewSearchContextValue = {
  query: string;
  setQuery: (q: string) => void;
  /** Desplaza a una sección y opcionalmente actualiza el término */
  goToSearch: (sectionId: string, term?: string) => void;
  focusHeroSearch: () => void;
};

const PreviewSearchContext = createContext<PreviewSearchContextValue | null>(null);

export function PreviewSearchProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("");

  const focusHeroSearch = useCallback(() => {
    const el = document.getElementById("hero-search-input") as HTMLInputElement | null;
    el?.focus();
    document.getElementById("inicio")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const goToSearch = useCallback((sectionId: string, term?: string) => {
    if (term !== undefined) setQuery(term);
    requestAnimationFrame(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const value = useMemo(
    () => ({ query, setQuery, goToSearch, focusHeroSearch }),
    [query, goToSearch, focusHeroSearch]
  );

  return <PreviewSearchContext.Provider value={value}>{children}</PreviewSearchContext.Provider>;
}

export function usePreviewSearch() {
  const ctx = useContext(PreviewSearchContext);
  if (!ctx) throw new Error("usePreviewSearch debe usarse dentro de PreviewSearchProvider");
  return ctx;
}
