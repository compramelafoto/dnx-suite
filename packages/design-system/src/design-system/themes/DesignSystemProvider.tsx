"use client";

import { createContext, useContext, type ReactNode } from "react";
import { colorModes } from "../tokens";
import type { ColorMode } from "../tokens";

export type ThemeBrand = {
  primary: string;
  primaryHover: string;
  accent?: string;
  accentHover?: string;
  soft?: string;
  gradient?: string;
};

export type ResolvedTheme = {
  background: { primary: string; secondary: string; tertiary: string };
  surface: { base: string; elevated: string; overlay: string };
  border: { subtle: string; default: string; strong: string };
  text: { primary: string; secondary: string; tertiary: string; disabled: string };
  state: { hover: string; active: string; focus: string };
  brand: ThemeBrand;
  mode: ColorMode;
};

type DesignSystemContextValue = {
  theme: ResolvedTheme;
  mode: ColorMode;
  setMode?: (mode: ColorMode) => void;
};

const DesignSystemContext = createContext<DesignSystemContextValue | null>(null);

export function DesignSystemProvider({
  theme: brand,
  mode,
  setMode = () => {},
  children,
}: {
  theme: ThemeBrand;
  mode: ColorMode;
  setMode?: (mode: ColorMode) => void;
  children: ReactNode;
}) {
  const theme: ResolvedTheme = {
    ...colorModes[mode],
    brand,
    mode,
  };
  return (
    <DesignSystemContext.Provider value={{ theme, mode, setMode }}>
      {children}
    </DesignSystemContext.Provider>
  );
}

export function useDesignSystem() {
  const ctx = useContext(DesignSystemContext);
  if (!ctx) throw new Error("useDesignSystem must be used within DesignSystemProvider");
  return ctx;
}

/** Brand colors - for Button primary etc. */
export function useTheme() {
  const ctx = useContext(DesignSystemContext);
  return ctx?.theme?.brand ?? null;
}

/** Full resolved theme with fallback to dark - for components that need mode. */
export function useResolvedTheme(): ResolvedTheme {
  const ctx = useContext(DesignSystemContext);
  if (ctx) return ctx.theme;
  return { ...colorModes.dark, brand: { primary: "#e5e5e5", primaryHover: "#d4d4d4" }, mode: "dark" } as ResolvedTheme;
}
