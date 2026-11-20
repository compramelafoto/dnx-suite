import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Una sección plegada: el título a la vista y el contenido al tocarlo. Para que las pantallas de
 * detalle queden cortas y ordenadas (lo de todos los días a la vista, lo demás plegado).
 */
export function Desplegable({
  titulo,
  detalle,
  abierto = false,
  children,
}: {
  titulo: string;
  /** Texto corto a la derecha del título (una cantidad, un estado). */
  detalle?: ReactNode;
  abierto?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={abierto} className="group fo-card !p-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-[var(--fo-text)] hover:bg-[var(--fo-surface-hover)] [&::-webkit-details-marker]:hidden">
        <span>{titulo}</span>
        <span className="flex items-center gap-2 text-xs font-normal text-[var(--fo-muted)]">
          {detalle}
          <ChevronDown className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
        </span>
      </summary>
      <div className="space-y-4 border-t border-[var(--fo-border)] p-4">{children}</div>
    </details>
  );
}
