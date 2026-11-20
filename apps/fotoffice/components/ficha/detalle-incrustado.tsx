import Link from "next/link";
import type { ReactNode } from "react";
import { Maximize2, X } from "lucide-react";
import { ANCLA_DETALLE, hrefCompleto, type TipoDetalle } from "@/lib/ficha/detalle-en-ficha";
import { ENTIDAD, estiloDeEntidad, type Entidad } from "@/lib/entidades/colores";

const ENTIDAD_DE: Record<TipoDetalle, Entidad> = {
  consulta: "consulta",
  cotizacion: "cotizacion",
  pedido: "pedido",
  contrato: "contrato",
  proyecto: "proyecto",
};

/**
 * El marco del elemento abierto adentro de la ficha del cliente: una franja de su color con
 * «Abrir completa» y «Cerrar», y la pantalla del elemento debajo.
 */
export function DetalleIncrustado({ tipo, id, hrefCerrar, children }: { tipo: TipoDetalle; id: string; hrefCerrar: string; children: ReactNode }) {
  const entidad = ENTIDAD_DE[tipo];
  return (
    <section
      id={ANCLA_DETALLE}
      aria-label={`${ENTIDAD[entidad].singular}, abierta en la ficha`}
      style={estiloDeEntidad(entidad)}
      className="scroll-mt-20 overflow-hidden rounded-[var(--fo-radius)] border border-[var(--fo-border)] bg-[var(--fo-bg)] shadow-[var(--fo-shadow-sm)] motion-safe:animate-[fo-desplegar_160ms_ease-out]"
    >
      <div className="flex items-center justify-between gap-2 bg-[var(--ent)] px-4 py-2 text-sm font-medium text-white">
        <span>{ENTIDAD[entidad].singular}</span>
        <span className="flex items-center gap-1">
          <Link href={hrefCompleto(tipo, id)} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-white/15">
            <Maximize2 className="size-3.5" aria-hidden />
            Abrir completa
          </Link>
          <Link href={hrefCerrar} scroll={false} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-white/15">
            <X className="size-3.5" aria-hidden />
            Cerrar
          </Link>
        </span>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}
