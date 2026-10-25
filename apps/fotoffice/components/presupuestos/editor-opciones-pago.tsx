"use client";

import { useId, useState } from "react";
import { X } from "lucide-react";
import {
  createEmptyInstallmentPlan,
  opcionesDeInstantanea,
  opcionesParaPresupuesto,
  type CuantoCobroInstallmentPlanInput,
  type CuantoCobroPaymentOptionsInput,
} from "@/lib/pedidos/opciones-pago";
import { pesos } from "@/lib/presupuestos/editor";
import { MAX_CUOTAS_PLAN, MAX_NOTA_OPCION, MAX_PLANES, pesosCuota } from "@/lib/presupuestos/opciones-pago";

/**
 * Editor de las opciones de pago, al estilo de ¿Cuánto Cobro? (spec etapa 3 §3.1 y §3.4): contado
 * (sí o no, con descuento %) y planes de N cuotas sin interés o con interés manual, cada uno con su
 * nota comercial. Lo usan Configuración → Presupuestos y el editor del presupuesto.
 *
 * El interés "sugerido por índice" de ¿Cuánto Cobro? consulta la red y no se porta: sólo aparece en
 * un plan que ya venía guardado así. Sin contado ni planes, el presupuesto ofrece la opción por
 * omisión ("Hasta N cuotas sin interés").
 *
 * Con `vistaPrevia` (el total y la fecha del evento del presupuesto) muestra en vivo lo que va a ver
 * el cliente, con la misma cuenta que congela el servidor al enviar. Con `nombre`, deja las
 * opciones en un campo oculto de ese nombre para un formulario.
 */
export function EditorOpcionesPago({
  valor,
  onCambio,
  vistaPrevia,
  nombre,
  deshabilitado = false,
}: {
  valor: CuantoCobroPaymentOptionsInput;
  onCambio: (v: CuantoCobroPaymentOptionsInput) => void;
  vistaPrevia?: { total: number; fechaEvento: string | null; hoy: string };
  nombre?: string;
  deshabilitado?: boolean;
}) {
  const id = useId();
  // Los planes que llegaron guardados con interés por índice: sólo esos pueden seguir así.
  const [conIndice] = useState(() => new Set(valor.installmentPlans.filter((p) => p.interestMode === "index_suggested").map((p) => p.id)));

  const cambiar = (parcial: Partial<CuantoCobroPaymentOptionsInput>) => onCambio({ ...valor, ...parcial });
  const cambiarPlan = (planId: string, parcial: Partial<CuantoCobroInstallmentPlanInput>) =>
    cambiar({ installmentPlans: valor.installmentPlans.map((p) => (p.id === planId ? { ...p, ...parcial } : p)) });
  const quitarPlan = (planId: string) => cambiar({ installmentPlans: valor.installmentPlans.filter((p) => p.id !== planId) });
  const agregarPlan = () => cambiar({ installmentPlans: [...valor.installmentPlans, { ...createEmptyInstallmentPlan(), appliedIndexMetadata: null }] });

  const previa = vistaPrevia
    ? opcionesDeInstantanea(opcionesParaPresupuesto({ paymentOptions: valor }, vistaPrevia.total, vistaPrevia.fechaEvento, vistaPrevia.hoy))
    : null;
  const sinOpciones = !valor.cashEnabled && valor.installmentPlans.length === 0;

  return (
    <div className="space-y-4">
      {nombre ? <input type="hidden" name={nombre} value={JSON.stringify(valor)} /> : null}

      <fieldset className="space-y-3" disabled={deshabilitado}>
        <legend className="sr-only">Contado</legend>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={valor.cashEnabled} onChange={(e) => cambiar({ cashEnabled: e.target.checked })} />
          Ofrecer pago de contado
        </label>
        {valor.cashEnabled ? (
          <div className="grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor={`${id}-desc`}>
                Descuento (%)
              </label>
              <input
                id={`${id}-desc`}
                className="fo-input"
                inputMode="decimal"
                value={valor.cashDiscountPercent}
                onChange={(e) => cambiar({ cashDiscountPercent: e.target.value })}
                placeholder="0"
              />
            </div>
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor={`${id}-nota-contado`}>
                Nota comercial
              </label>
              <input
                id={`${id}-nota-contado`}
                className="fo-input"
                maxLength={MAX_NOTA_OPCION}
                value={valor.cashCommercialNote}
                onChange={(e) => cambiar({ cashCommercialNote: e.target.value })}
                placeholder="Ej.: transferencia al confirmar"
              />
            </div>
          </div>
        ) : null}
      </fieldset>

      <fieldset className="space-y-3" disabled={deshabilitado}>
        <legend className="text-sm font-medium">Planes de cuotas</legend>
        {valor.installmentPlans.length === 0 ? <p className="text-sm text-[var(--fo-muted)]">No hay planes de cuotas.</p> : null}
        {valor.installmentPlans.map((p, i) => (
          <div key={p.id} className="grid items-end gap-3 rounded-lg border border-[var(--fo-border)] p-3 sm:grid-cols-[6rem_10rem_6rem_minmax(0,1fr)_auto]">
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor={`${id}-${i}-n`}>
                Cuotas
              </label>
              <input
                id={`${id}-${i}-n`}
                className="fo-input"
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_CUOTAS_PLAN}
                step={1}
                value={p.numberOfInstallments}
                onChange={(e) => cambiarPlan(p.id, { numberOfInstallments: e.target.value })}
              />
            </div>
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor={`${id}-${i}-modo`}>
                Interés
              </label>
              <select
                id={`${id}-${i}-modo`}
                className="fo-input"
                value={p.interestMode}
                onChange={(e) => cambiarPlan(p.id, { interestMode: e.target.value as CuantoCobroInstallmentPlanInput["interestMode"] })}
              >
                <option value="none">Sin interés</option>
                <option value="manual">Con interés</option>
                {conIndice.has(p.id) ? <option value="index_suggested">Sugerido por índice</option> : null}
              </select>
            </div>
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor={`${id}-${i}-tasa`}>
                %
              </label>
              <input
                id={`${id}-${i}-tasa`}
                className="fo-input"
                inputMode="decimal"
                value={p.interestMode === "none" ? "" : p.interestPercent}
                disabled={p.interestMode === "none"}
                onChange={(e) => cambiarPlan(p.id, { interestPercent: e.target.value })}
              />
            </div>
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor={`${id}-${i}-nota`}>
                Nota comercial
              </label>
              <input
                id={`${id}-${i}-nota`}
                className="fo-input"
                maxLength={MAX_NOTA_OPCION}
                value={p.commercialNote}
                onChange={(e) => cambiarPlan(p.id, { commercialNote: e.target.value })}
              />
            </div>
            <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={() => quitarPlan(p.id)} aria-label={`Quitar el plan ${i + 1}`}>
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ))}
        {valor.installmentPlans.length < MAX_PLANES ? (
          <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={agregarPlan}>
            Agregar plan de cuotas
          </button>
        ) : null}
      </fieldset>

      {sinOpciones && !previa ? (
        <p className="text-sm text-[var(--fo-muted)]">
          Sin contado ni planes, cada presupuesto ofrece «Hasta 6 cuotas sin interés» (o menos, si faltan menos de 6 meses
          para el evento).
        </p>
      ) : null}

      {previa ? (
        <div className="space-y-2" aria-live="polite">
          <p className="text-sm font-medium">Lo que va a ver el cliente</p>
          <ul className="divide-y divide-[var(--fo-border)] text-sm">
            {previa.map((o) => (
              <li key={o.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <span>
                  {o.etiqueta}
                  {o.nota && o.nota !== o.etiqueta ? <span className="block text-xs text-[var(--fo-muted)]">{o.nota}</span> : null}
                </span>
                <span className="tabular-nums">
                  {o.cuotas > 1 ? `${o.cuotas} × ${pesosCuota(o.importeCuota)} · ` : ""}
                  Total {pesos(o.total)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
