"use client";

/**
 * Estado vacío centrado: icono opcional, título, descripción y acción.
 */

import type { CSSProperties, ReactNode } from "react";
import { compositionSpacing } from "../../tokens";
import { cn } from "../../utils";
import { Text } from "../typography/Text";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function EmptyState({ icon, title, description, action, className, style }: EmptyStateProps) {
  return (
    <div
      className={cn(className)}
      style={{
        maxWidth: "22rem",
        margin: "0 auto",
        padding: compositionSpacing.stack.block,
        textAlign: "center",
        ...style,
      }}
    >
      {icon != null ? (
        <div
          style={{
            marginBottom: compositionSpacing.stack.subtitleToContent,
            display: "flex",
            justifyContent: "center",
          }}
        >
          {icon}
        </div>
      ) : null}
      <Text variant="h3" as="h3">
        {title}
      </Text>
      {description != null ? (
        <div style={{ marginTop: compositionSpacing.stack.titleToSubtitle }}>
          <Text variant="muted" as="p">
            {description}
          </Text>
        </div>
      ) : null}
      {action != null ? (
        <div
          style={{
            marginTop: compositionSpacing.stack.subtitleToContent,
            display: "flex",
            justifyContent: "center",
          }}
        >
          {action}
        </div>
      ) : null}
    </div>
  );
}
