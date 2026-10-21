"use client";

import { useState } from "react";
import type { CuantoCobroProfileInput } from "@repo/cuanto-cobro-core";
import { CampoTexto } from "@/components/presupuestos/panel-cuanto-cobro";
import { DesglosePrecio } from "@/components/presupuestos/desglose-precio";
import { enPesos } from "@/lib/precios/pesos";
import { nuevoGasto, presupuestarTrabajo, trabajoSocioVacio, type TrabajoSocio } from "@/lib/cuanto-cobro-socio/trabajo";

function Fila({ etiqueta, valor, fuerte = false }: { etiqueta: string; valor: string; fuerte?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${fuerte ? "font-semibold" : ""}`}>
      <dt className={fuerte ? "" : "text-[var(--fo-muted)]"}>{etiqueta}</dt>
      <dd className="whitespace-nowrap tabular-nums">{valor}</dd>
    </div>
  );
}

const horas = (n: number) => `${(Math.round(n * 10) / 10).toLocaleString("es-AR")} h`;

/**
 * El paso «Presupuestar un trabajo»: las horas de ese trabajo al valor de tu hora, más los gastos
 * variables del evento. Calcula con el perfil que se está editando, sin guardar: se puede probar
 * un trabajo y volver atrás a corregir un gasto.
 */
export function SeccionPresupuestoTrabajo({ perfil }: { perfil: CuantoCobroProfileInput }) {
  const [trabajo, setTrabajo] = useState<TrabajoSocio>(trabajoSocioVacio);
  const set = (k: Exclude<keyof TrabajoSocio, "gastos">) => (v: string) => setTrabajo((t) => ({ ...t, [k]: v }));
  const setGasto = (id: string, parcial: { concepto?: string; monto?: string }) =>
    setTrabajo((t) => ({ ...t, gastos: t.gastos.map((g) => (g.id === id ? { ...g, ...parcial } : g)) }));

  const r = presupuestarTrabajo(perfil, trabajo);
  const p = r.ok ? r.presupuesto : null;

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">El trabajo</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <CampoTexto etiqueta="Qué trabajo es" tipo="text" valor={trabajo.tipoDeTrabajo} onCambio={set("tipoDeTrabajo")} ayuda="Por ejemplo: casamiento, 15 años, sesión de producto." />
          <CampoTexto etiqueta="Horas del evento" valor={trabajo.horasCobertura} onCambio={set("horasCobertura")} />
          <CampoTexto etiqueta="Horas de edición" valor={trabajo.horasEdicion} onCambio={set("horasEdicion")} />
          <CampoTexto etiqueta="Horas de entrega" valor={trabajo.horasEntrega} onCambio={set("horasEntrega")} ayuda="Armar la galería, el pendrive o el álbum." />
          <CampoTexto etiqueta="Horas de viaje" valor={trabajo.horasViaje} onCambio={set("horasViaje")} />
          <CampoTexto etiqueta="Horas con el cliente" valor={trabajo.horasCliente} onCambio={set("horasCliente")} ayuda="Reuniones, mensajes y coordinación." />
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Gastos variables de este evento</h3>
          <p className="text-sm text-[var(--fo-muted)]">
            Lo que gastás sólo porque hacés este trabajo. No va en los gastos fijos: si no hay evento, no lo pagás.
          </p>
        </div>
        <ul className="space-y-3">
          {trabajo.gastos.map((g, i) => (
            <li key={g.id} className="grid items-end gap-3 sm:grid-cols-[1fr_12rem_auto]">
              <CampoTexto etiqueta={`Gasto ${i + 1}`} tipo="text" valor={g.concepto} onCambio={(v) => setGasto(g.id, { concepto: v })} />
              <CampoTexto etiqueta="Cuánto" tipo="moneda" valor={g.monto} onCambio={(v) => setGasto(g.id, { monto: v })} />
              <button
                type="button"
                className="fo-btn fo-btn-ghost text-sm"
                aria-label={`Quitar ${g.concepto.trim() || `el gasto ${i + 1}`}`}
                onClick={() => setTrabajo((t) => ({ ...t, gastos: t.gastos.filter((x) => x.id !== g.id) }))}
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={() => setTrabajo((t) => ({ ...t, gastos: [...t.gastos, nuevoGasto()] }))}>
          Agregar gasto
        </button>
      </section>

      {/* Región viva siempre presente: anuncia sólo el resultado, no cada dato que falta. */}
      <p className="sr-only" aria-live="polite">
        {p ? `Precio sugerido: ${enPesos(p.precioSugerido)}` : ""}
      </p>
      {p ? (
        <section aria-label="Cuánto cobrar" className="space-y-4 rounded-xl border border-[var(--fo-border-strong)] bg-[var(--fo-surface-muted)] p-4 text-sm">
          <div>
            <p className="text-[var(--fo-muted)]">Cobrá</p>
            <p className="text-2xl font-bold tabular-nums text-[var(--fo-accent)]">{enPesos(p.precioSugerido)}</p>
            <p className="text-[var(--fo-muted)]">Menos de {enPesos(p.precioMinimo)} es trabajar a pérdida.</p>
          </div>
          <dl className="space-y-1.5">
            <Fila etiqueta={`Tus horas: ${horas(p.horas)} a ${enPesos(p.valorHora)}`} valor={enPesos(p.horas * p.valorHora)} />
            {p.gastos.map((g, i) => (
              <Fila key={i} etiqueta={g.concepto} valor={enPesos(g.monto)} />
            ))}
            {p.gastos.length > 1 ? <Fila etiqueta="Gastos del evento" valor={enPesos(p.totalGastos)} /> : null}
            <Fila etiqueta="Lo que te cuesta hacerlo" valor={enPesos(p.costo)} fuerte />
            <Fila etiqueta="Precio mínimo sostenible" valor={enPesos(p.precioMinimo)} />
            <Fila etiqueta="Precio recomendado para tu momento" valor={enPesos(p.precioRecomendado)} />
            <Fila etiqueta="Te queda arriba del costo" valor={enPesos(p.ganancia)} fuerte />
          </dl>
          {p.desglose ? <DesglosePrecio linea={p.desglose} /> : null}
          {p.advertencias.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-xs text-[var(--fo-muted)]">
              {p.advertencias.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : !r.ok ? (
        <div className="rounded-xl border border-[var(--fo-border)] p-4 text-sm">
          <p>{r.error}</p>
          {r.faltan.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[var(--fo-muted)]">
              {r.faltan.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
