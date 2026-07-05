import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Wrapper para empty states del catálogo: ancho completo del panel sin colapso a min-content.
 * Usar siempre como hijo directo de `.ds-stack-section` en listados vacíos secundarios.
 */
export function CatalogProductsEmptyShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("ds-catalog-empty-shell ds-fill-width w-full min-w-0 max-w-full", className)}>
      {children}
    </div>
  );
}
