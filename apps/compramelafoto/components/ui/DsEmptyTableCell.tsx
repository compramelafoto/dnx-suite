import type { ReactNode, TdHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type DsEmptyTableCellProps = Omit<TdHTMLAttributes<HTMLTableCellElement>, "children"> & {
  colSpan: number;
  children: ReactNode;
  /** Clases extra para el contenedor interno (p. ej. `min-w-[1120px]` alineado al `min-width` de la tabla). */
  innerClassName?: string;
};

/**
 * Celda de estado vacío estándar — evita párrafos en columnas ultrafinas dentro de tablas con scroll.
 * Ver `styles/design-system/readable-content.css` (`.ds-table-empty-*`).
 */
export function DsEmptyTableCell({
  colSpan,
  children,
  className,
  innerClassName,
  ...tdProps
}: DsEmptyTableCellProps) {
  return (
    <td {...tdProps} colSpan={colSpan} className={cn("ds-table-empty-cell", className)}>
      <div className={cn("ds-table-empty-inner", innerClassName)}>
        <div className="ds-table-empty-message" role="status">
          {children}
        </div>
      </div>
    </td>
  );
}
