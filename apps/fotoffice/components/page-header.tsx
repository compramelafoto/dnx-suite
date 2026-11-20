import { IconoEntidad } from "@/components/entidades/entidad";
import type { Entidad } from "@/lib/entidades/colores";
export function PageHeader({
  title,
  description,
  actions,
  entidad,
  nivel = "h1",
}: {
  title: string;
  /** Texto o contenido con enlaces (por ejemplo, el nombre del cliente que lleva a su ficha). */
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** El elemento de la pantalla (consulta, pedido…): el título lleva su ícono y su color. */
  entidad?: Entidad;
  /** `h2` cuando la pantalla se muestra adentro de otra (la ficha del cliente ya tiene su `h1`). */
  nivel?: "h1" | "h2";
}) {
  const Titulo = nivel;
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-2 min-w-0">
        <Titulo className={`flex items-center gap-3 font-semibold tracking-tight text-[var(--fo-text)] ${nivel === "h1" ? "text-2xl" : "text-xl"}`}>
          {entidad ? <IconoEntidad entidad={entidad} tamano="lg" /> : null}
          <span className="min-w-0">{title}</span>
        </Titulo>
        {description ? (
          <p className="text-sm text-[var(--fo-muted)] max-w-2xl leading-relaxed">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2 shrink-0">{actions}</div> : null}
    </div>
  );
}
