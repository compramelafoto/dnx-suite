import Link from "next/link";
import { claseDeColorEtiqueta } from "@/lib/ficha/formato";
import type { ConsultaDelContacto } from "@/lib/contactos/consultas-del-contacto";

/**
 * Tarjeta "Consultas" de la ficha del contacto (spec §3.3): número, categoría, fecha del evento,
 * etapa o resultado y valor de cada consulta, con enlace a su ficha. El botón "Nueva consulta
 * para este contacto" sólo aparece con "Gestionar" en Consultas (lo decide el servidor).
 */
export function ConsultasDelContacto({
  clientId,
  consultas,
  hayMas,
  puedeCrear,
}: {
  clientId: string;
  consultas: ConsultaDelContacto[];
  hayMas: boolean;
  puedeCrear: boolean;
}) {
  return (
    <section aria-labelledby="contacto-consultas-titulo" className="fo-card space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="contacto-consultas-titulo" className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
          Consultas
        </h2>
      </div>
      {consultas.length === 0 ? (
        <p className="text-sm text-[var(--fo-muted)]">Todavía no hizo ninguna consulta.</p>
      ) : (
        <ul className="divide-y divide-[var(--fo-border)] text-sm">
          {consultas.map((c) => (
            <li key={c.id} className="py-2 first:pt-0 last:pb-0">
              <Link href={c.href} className="block rounded-[var(--fo-radius-sm)] hover:bg-[var(--fo-surface-hover)]">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium text-[var(--fo-text)]">
                    {c.numero ? `N° ${c.numero}` : "Sin número"}
                    {c.categoria ? <span className="font-normal text-[var(--fo-muted)]"> · {c.categoria}</span> : null}
                  </span>
                  {c.valor ? <span className="shrink-0 text-[var(--fo-text)]">{c.valor}</span> : null}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--fo-muted)]">
                  <span>{c.fechaEvento ? `Evento: ${c.fechaEvento}` : "Sin fecha de evento"}</span>
                  {c.estado ? (
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${
                        c.estado.cerrada
                          ? claseDeColorEtiqueta(c.estado.ganada ? "verde" : "rojo")
                          : claseDeColorEtiqueta(c.estado.color ?? "gris")
                      }`}
                    >
                      {c.estado.texto}
                    </span>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {hayMas ? <p className="text-xs text-[var(--fo-muted)]">Se muestran las más recientes.</p> : null}
      {puedeCrear ? (
        <Link
          href={`/consultas/nueva?contacto=${encodeURIComponent(clientId)}`}
          className="fo-btn fo-btn-secondary w-full justify-center text-sm"
        >
          Nueva consulta para este contacto
        </Link>
      ) : null}
    </section>
  );
}
