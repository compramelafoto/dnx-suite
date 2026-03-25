"use client";

/**
 * Zona central del sidebar con scroll vertical (navegación). Va entre header y footer.
 */

import type { CSSProperties, ReactNode } from "react";
import { spacing } from "../../tokens";
import { cn } from "../../utils";

export interface SidebarBodyProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function SidebarBody({ children, className, style }: SidebarBodyProps) {
  return (
    <div
      className={cn(className)}
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        paddingLeft: spacing[4],
        paddingRight: spacing[4],
        paddingBottom: spacing[4],
        ...style,
      }}
    >
      {children}
    </div>
  );
}
