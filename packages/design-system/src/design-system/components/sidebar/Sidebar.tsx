"use client";

/**
 * Contenedor principal del menú lateral (columna). Sin padding interno forzado:
 * usá `SidebarHeader`, `SidebarBody` (zona scroll) y `SidebarFooter` en orden.
 */

import type { CSSProperties, ReactNode } from "react";
import { useResolvedTheme } from "../../themes";
import { cn } from "../../utils";
import { SIDEBAR_WIDTH_PX } from "./constants";

export interface SidebarProps {
  children: ReactNode;
  width?: number;
  className?: string;
  style?: CSSProperties;
}

export function Sidebar({ children, width = SIDEBAR_WIDTH_PX, className, style }: SidebarProps) {
  const theme = useResolvedTheme();

  return (
    <aside
      className={cn(className)}
      style={{
        width,
        minWidth: width,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        boxSizing: "border-box",
        background: theme.surface.base,
        borderRight: `1px solid ${theme.border.subtle}`,
        ...style,
      }}
    >
      {children}
    </aside>
  );
}
