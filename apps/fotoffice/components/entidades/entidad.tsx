import type { ReactNode } from "react";
import {
  CalendarDays,
  Calculator,
  CircleCheckBig,
  ClipboardList,
  FileSignature,
  FolderKanban,
  Hourglass,
  Images,
  MessagesSquare,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CLASE_ENTIDAD, ENTIDAD, estiloDeEntidad, type Entidad } from "@/lib/entidades/colores";

/**
 * Piezas visuales con el color y el ícono de cada elemento (consulta, cotización, pedido…).
 * Sin estado ni hooks: sirven en componentes de servidor y de cliente.
 */
export const ICONO_ENTIDAD: Record<Entidad, LucideIcon> = {
  cliente: UserRound,
  consulta: MessagesSquare,
  cotizacion: Calculator,
  pedido: ClipboardList,
  contrato: FileSignature,
  proyecto: FolderKanban,
  galeria: Images,
  agenda: CalendarDays,
  cobrado: CircleCheckBig,
  porCobrar: Hourglass,
};

const TAMANO = {
  sm: { caja: "size-6 rounded-md", icono: "size-3.5" },
  md: { caja: "size-8 rounded-lg", icono: "size-4" },
  lg: { caja: "size-10 rounded-xl", icono: "size-5" },
} as const;

/** El ícono del elemento en blanco sobre su color. */
export function IconoEntidad({ entidad, tamano = "md", className = "" }: { entidad: Entidad; tamano?: keyof typeof TAMANO; className?: string }) {
  const Icono = ICONO_ENTIDAD[entidad];
  const t = TAMANO[tamano];
  return (
    <span aria-hidden style={estiloDeEntidad(entidad)} className={`inline-flex shrink-0 items-center justify-center text-white ${CLASE_ENTIDAD.fondo} ${t.caja} ${className}`}>
      <Icono className={t.icono} />
    </span>
  );
}

/** Título de una tarjeta de la ficha (Cotizaciones, Pedidos…), con el ícono del elemento. */
export function TituloEntidad({ entidad, id, children, cantidad }: { entidad: Entidad; id?: string; children?: ReactNode; cantidad?: number }) {
  return (
    <h2 id={id} className="flex items-center gap-2 text-base font-semibold text-[var(--fo-text)]">
      <IconoEntidad entidad={entidad} tamano="sm" />
      <span>{children ?? ENTIDAD[entidad].plural}</span>
      {cantidad !== undefined && cantidad > 0 ? (
        <span style={estiloDeEntidad(entidad)} className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${CLASE_ENTIDAD.tinte} ${CLASE_ENTIDAD.texto}`}>
          {cantidad}
        </span>
      ) : null}
    </h2>
  );
}

/** Clases del contenedor de una tarjeta de elemento: la franja de color arriba. */
export function claseTarjetaEntidad(): string {
  return `fo-card space-y-3 p-4 ${CLASE_ENTIDAD.bordeArriba}`;
}
