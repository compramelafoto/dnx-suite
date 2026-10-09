import Link from "next/link";
import { claseDeColorEtiqueta } from "@/lib/ficha/formato";
import { fechaCorta } from "@/lib/pedidos/pantalla";
import { ETIQUETA_ESTADO, type EstadoDeProyecto } from "@/lib/proyectos/ficha-vista";

/** Lo que muestra la tarjeta de cada proyecto (el mismo tipo que devuelve `proyectosParaTarjeta`). */
export type ProyectoDeTarjetaVista = {
  id: string;
  numero: string;
  nombre: string;
  etapa: string | null;
  finalDueDate: string | null;
  estado: EstadoDeProyecto;
};

const COLOR: Record<EstadoDeProyecto, string> = { EN_CURSO: "azul", SUSPENDIDO: "amarillo", CERRADO: "gris" };

/**
 * Tarjeta "Proyectos" de la ficha de la consulta y del contacto: número, nombre, etapa y fecha
 * final, con enlace al proyecto. Es de lectura: los proyectos se crean desde el pedido.
 */
export function TarjetaProyectos({ proyectos, vacio = "Todavía no hay proyectos." }: { proyectos: ProyectoDeTarjetaVista[]; vacio?: string }) {
  return (
    <section aria-labelledby="tarjeta-proyectos-titulo" className="fo-card space-y-3 p-4">
      <h2 id="tarjeta-proyectos-titulo" className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
        Proyectos
      </h2>
      {proyectos.length === 0 ? (
        <p className="text-sm text-[var(--fo-muted)]">{vacio}</p>
      ) : (
        <ul className="divide-y divide-[var(--fo-border)] text-sm">
          {proyectos.map((p) => (
            <li key={p.id} className="py-2 first:pt-0 last:pb-0">
              <Link href={`/proyectos/${encodeURIComponent(p.id)}`} className="block rounded-[var(--fo-radius-sm)] hover:bg-[var(--fo-surface-hover)]">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate font-medium text-[var(--fo-text)]">{p.nombre}</span>
                  <span className="shrink-0 text-xs tabular-nums text-[var(--fo-muted)]">N° {p.numero}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--fo-muted)]">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${claseDeColorEtiqueta(COLOR[p.estado])}`}>
                    {p.estado === "EN_CURSO" && p.etapa ? p.etapa : ETIQUETA_ESTADO[p.estado]}
                  </span>
                  {p.finalDueDate ? <span>Entrega {fechaCorta(p.finalDueDate)}</span> : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
