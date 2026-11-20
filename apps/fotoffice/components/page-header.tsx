import { IconoEntidad } from "@/components/entidades/entidad";
import type { Entidad } from "@/lib/entidades/colores";
export function PageHeader({
  title,
  description,
  actions,
  entidad,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  /** El elemento de la pantalla (consulta, pedido…): el título lleva su ícono y su color. */
  entidad?: Entidad;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-2 min-w-0">
        <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight text-[var(--fo-text)]">
          {entidad ? <IconoEntidad entidad={entidad} tamano="lg" /> : null}
          <span className="min-w-0">{title}</span>
        </h1>
        {description ? (
          <p className="text-sm text-[var(--fo-muted)] max-w-2xl leading-relaxed">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2 shrink-0">{actions}</div> : null}
    </div>
  );
}
