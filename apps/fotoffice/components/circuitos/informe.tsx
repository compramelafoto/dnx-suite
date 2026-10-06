"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { InformeCircuito } from "@/lib/circuitos/informe";
import { ATAJOS_PERIODO, ETIQUETAS_PERIODO, esAtajoPeriodo, etiquetaPeriodo } from "@/lib/listado/periodos";

const RUTA = "/consultas/informe";
const dias = (n: number | null) => (n === null ? "—" : `${n.toLocaleString("es-AR")} ${n === 1 ? "día" : "días"}`);

/**
 * Informe por circuito: barra con período (los atajos del listado, en hora de Buenos Aires) y
 * circuito, y la tabla por etapa con los cierres y los motivos de pérdida.
 */
export function Informe({
  circuitos,
  circuito,
  periodo,
  datos,
}: {
  circuitos: { id: string; nombre: string }[];
  circuito: string | null;
  periodo: string;
  datos: InformeCircuito | null;
}) {
  const router = useRouter();

  function irA(cambios: { periodo?: string; circuito?: string }) {
    const q = new URLSearchParams();
    q.set("periodo", cambios.periodo ?? periodo);
    const c = cambios.circuito ?? circuito;
    if (c) q.set("circuito", c);
    router.push(`${RUTA}?${q.toString()}`);
  }

  if (circuitos.length === 0 || !circuito) {
    return (
      <div className="fo-card space-y-2 text-sm">
        <p className="text-[var(--fo-muted)]">Todavía no hay un circuito de venta activo para armar el informe.</p>
        <Link href="/workspace/configuracion/circuitos" className="font-medium text-[var(--fo-accent)] hover:underline">
          Ir a Configuración → Circuitos
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="fo-field-stack">
          <span className="fo-label">Período</span>
          <select className="fo-input" value={periodo} onChange={(ev) => irA({ periodo: ev.target.value })}>
            {esAtajoPeriodo(periodo) ? null : <option value={periodo}>{etiquetaPeriodo(periodo)}</option>}
            {ATAJOS_PERIODO.map((a) => (
              <option key={a} value={a}>
                {ETIQUETAS_PERIODO[a]}
              </option>
            ))}
          </select>
        </label>
        {circuitos.length > 1 ? (
          <label className="fo-field-stack">
            <span className="fo-label">Circuito</span>
            <select className="fo-input" value={circuito} onChange={(ev) => irA({ circuito: ev.target.value })}>
              {circuitos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {datos ? (
        <>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="fo-card">
              <dt className="text-xs text-[var(--fo-muted)]">Ganadas</dt>
              <dd className="text-2xl font-semibold text-[var(--fo-text)]">{datos.ganadas}</dd>
            </div>
            <div className="fo-card">
              <dt className="text-xs text-[var(--fo-muted)]">Perdidas</dt>
              <dd className="text-2xl font-semibold text-[var(--fo-text)]">{datos.perdidas}</dd>
            </div>
          </dl>

          <section aria-labelledby="informe-etapas" className="fo-card space-y-2">
            <h2 id="informe-etapas" className="text-base font-semibold text-[var(--fo-text)]">
              Por etapa
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-[var(--fo-muted)]">
                    <th scope="col" className="py-1 pr-3 font-medium">Etapa</th>
                    <th scope="col" className="py-1 pr-3 font-medium">Entraron</th>
                    <th scope="col" className="py-1 pr-3 font-medium">Tiempo promedio</th>
                    <th scope="col" className="py-1 font-medium">Perdidas desde acá</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.etapas.map((e) => (
                    <tr key={e.id} className="border-t border-[var(--fo-border)]">
                      <td className="py-1.5 pr-3 text-[var(--fo-text)]">
                        {e.nombre}
                        {e.archivada ? <span className="ml-1 text-xs text-[var(--fo-muted)]">(archivada)</span> : null}
                      </td>
                      <td className="py-1.5 pr-3">{e.pasaron}</td>
                      <td className="py-1.5 pr-3">{dias(e.diasPromedio)}</td>
                      <td className="py-1.5">{e.perdidasDesdeAca}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-[var(--fo-muted)]">
              El tiempo promedio mide, para las consultas que salieron de cada etapa en el período, cuánto estuvieron en ella.
            </p>
          </section>

          <section aria-labelledby="informe-motivos" className="fo-card space-y-2">
            <h2 id="informe-motivos" className="text-base font-semibold text-[var(--fo-text)]">
              Motivos de pérdida
            </h2>
            {datos.motivos.length === 0 ? (
              <p className="text-sm text-[var(--fo-muted)]">No hubo pérdidas en el período.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {datos.motivos.map((m) => (
                  <li key={m.nombre} className="flex justify-between gap-3">
                    <span className="text-[var(--fo-text)]">{m.nombre}</span>
                    <span className="text-[var(--fo-muted)]">{m.cantidad}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : (
        <p className="fo-card text-sm text-[var(--fo-muted)]">No encontramos ese circuito.</p>
      )}
    </div>
  );
}
