import Link from "next/link";
import { claseDeColorEtiqueta } from "@/lib/ficha/formato";
import { ETIQUETA_ESTADO, type EstadoPresupuesto } from "@/lib/presupuestos/constantes";
import { pesos } from "@/lib/presupuestos/editor";

/** Lo que muestra la tarjeta de cada presupuesto: nunca costos. */
export type PresupuestoDeTarjeta = {
  id: string;
  numero: string | null;
  estado: EstadoPresupuesto;
  total: number;
  validUntil: string | null;
  version: number;
};

const COLOR: Record<EstadoPresupuesto, string> = {
  BORRADOR: "gris",
  ENVIADO: "azul",
  VISTO: "violeta",
  ACEPTADO: "verde",
  RECHAZADO: "rojo",
  VENCIDO: "naranja",
};

/** Puro: de una fila de `listarPresupuestos` a la tarjeta (descarta costo y margen). */
export function aTarjeta(f: PresupuestoDeTarjeta): PresupuestoDeTarjeta {
  return { id: f.id, numero: f.numero, estado: f.estado, total: f.total, validUntil: f.validUntil, version: f.version };
}

/**
 * Tarjeta "Presupuestos" de la ficha de la consulta y del contacto (spec §2 A.11): número,
 * versión, estado, total y vencimiento, con enlace al presupuesto. "Nuevo presupuesto" sólo con
 * "Gestionar" en Presupuestos (lo decide el servidor).
 */
export function TarjetaPresupuestos({
  presupuestos,
  hrefNuevo,
  puedeCrear,
  vacio = "Todavía no hay presupuestos.",
}: {
  presupuestos: PresupuestoDeTarjeta[];
  hrefNuevo: string;
  puedeCrear: boolean;
  vacio?: string;
}) {
  return (
    <section aria-labelledby="tarjeta-presupuestos-titulo" className="fo-card space-y-3 p-4">
      <h2 id="tarjeta-presupuestos-titulo" className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
        Presupuestos
      </h2>
      {presupuestos.length === 0 ? (
        <p className="text-sm text-[var(--fo-muted)]">{vacio}</p>
      ) : (
        <ul className="divide-y divide-[var(--fo-border)] text-sm">
          {presupuestos.map((p) => (
            <li key={p.id} className="py-2 first:pt-0 last:pb-0">
              <Link href={`/presupuestos/${encodeURIComponent(p.id)}`} className="block rounded-[var(--fo-radius-sm)] hover:bg-[var(--fo-surface-hover)]">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium text-[var(--fo-text)]">
                    {p.numero ? `N° ${p.numero}` : "Sin enviar"}
                    <span className="font-normal text-[var(--fo-muted)]"> · V{p.version}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-[var(--fo-text)]">{pesos(p.total)}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--fo-muted)]">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${claseDeColorEtiqueta(COLOR[p.estado])}`}>{ETIQUETA_ESTADO[p.estado]}</span>
                  {p.validUntil ? <span>Vence {p.validUntil.split("-").reverse().join("/")}</span> : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {puedeCrear ? (
        <Link href={hrefNuevo} className="fo-btn fo-btn-secondary w-full justify-center text-sm">
          Nuevo presupuesto
        </Link>
      ) : null}
    </section>
  );
}
