"use client";

/**
 * Agrupa ítems de navegación bajo un título opcional (ej. "Gestión", "Finanzas").
 * Usar una sección por bloque funcional; dentro, `SidebarItem` o `SidebarNavFromConfig`.
 */

import type { CSSProperties, ReactNode } from "react";
import { spacing } from "../../tokens";
import { useResolvedTheme } from "../../themes";
import { cn } from "../../utils";
import { Text } from "../typography/Text";

export interface SidebarSectionProps {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function SidebarSection({ title, children, className, style }: SidebarSectionProps) {
  const theme = useResolvedTheme();

  return (
    <section className={cn(className)} style={{ marginBottom: spacing[6], ...style }}>
      {title != null && title !== "" ? (
        <div style={{ marginBottom: spacing[3], paddingLeft: spacing[2] }}>
          <Text
            variant="helper"
            as="h2"
            style={{
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: theme.text.tertiary,
              fontWeight: 600,
            }}
          >
            {title}
          </Text>
        </div>
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", gap: spacing[1] }} role="group">
        {children}
      </div>
    </section>
  );
}
