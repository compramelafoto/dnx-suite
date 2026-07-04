"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type GateVisibilityContextValue = {
  gateVisible: boolean;
  setGateVisible: (visible: boolean) => void;
};

const GateVisibilityContext = createContext<GateVisibilityContextValue | null>(null);

export function GateVisibilityProvider({ children }: { children: ReactNode }) {
  const [gateVisible, setGateVisible] = useState(false);
  return (
    <GateVisibilityContext.Provider value={{ gateVisible, setGateVisible }}>
      {children}
    </GateVisibilityContext.Provider>
  );
}

export function useGateVisibility() {
  const ctx = useContext(GateVisibilityContext);
  return ctx;
}
