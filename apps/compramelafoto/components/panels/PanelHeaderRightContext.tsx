"use client";

import { createContext, useContext, type ReactNode } from "react";

type PanelHeaderRightContextValue = {
  setHeaderRight: (node: ReactNode) => void;
};

const PanelHeaderRightContext = createContext<PanelHeaderRightContextValue | null>(null);

export function usePanelHeaderRight() {
  const ctx = useContext(PanelHeaderRightContext);
  return ctx;
}

export { PanelHeaderRightContext };
