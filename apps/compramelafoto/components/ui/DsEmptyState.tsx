import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type DsEmptyStateProps = {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  variant?: "default" | "tight";
};

/**
 * Bloque vacío reutilizable para cards o secciones (no tablas).
 */
export function DsEmptyState({
  title,
  children,
  className,
  variant = "default",
}: DsEmptyStateProps) {
  return (
    <div
      className={cn("ds-empty-state", variant === "tight" && "ds-empty-state--tight", className)}
      role="status"
    >
      {title != null && title !== false ? (
        typeof title === "string" ? (
          <h3 className="ds-empty-state__title">{title}</h3>
        ) : (
          <div className="ds-empty-state__title">{title}</div>
        )
      ) : null}
      <div className="ds-empty-state__body">{children}</div>
    </div>
  );
}
