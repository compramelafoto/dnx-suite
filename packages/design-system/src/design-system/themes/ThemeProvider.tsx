"use client";

import type { ReactNode } from "react";
import { DesignSystemProvider } from "./DesignSystemProvider";
import type { ThemeBrand } from "./DesignSystemProvider";

/** @deprecated Use DesignSystemProvider with mode */
export function ThemeProvider({
  theme,
  children,
}: {
  theme: ThemeBrand;
  children: ReactNode;
}) {
  return (
    <DesignSystemProvider theme={theme} mode="dark">
      {children}
    </DesignSystemProvider>
  );
}

export { useTheme } from "./DesignSystemProvider";
