"use client";

/**
 * Título de sección + descripción opcional con ritmo vertical del sistema.
 * Usar encima de listas, formularios o grids (no sustituye el H1 de página).
 */

import type { CSSProperties, ReactNode } from "react";
import { compositionSpacing } from "../../tokens";
import { cn } from "../../utils";
import { Text } from "../typography/Text";

export interface SectionTitleProps {
  title: ReactNode;
  description?: ReactNode;
  /** `section` = h2, `subsection` = h3 */
  level?: "section" | "subsection";
  className?: string;
  style?: CSSProperties;
}

export function SectionTitle({
  title,
  description,
  level = "section",
  className,
  style,
}: SectionTitleProps) {
  const variant = level === "section" ? "h2" : "h3";
  const as = level === "section" ? "h2" : "h3";

  return (
    <header className={cn(className)} style={{ marginBottom: compositionSpacing.stack.block, ...style }}>
      <Text variant={variant} as={as}>
        {title}
      </Text>
      {description != null ? (
        <div style={{ marginTop: compositionSpacing.stack.titleToSubtitle }}>
          <Text variant="muted" as="p">
            {description}
          </Text>
        </div>
      ) : null}
    </header>
  );
}
