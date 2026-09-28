"use client";

import { useActionState } from "react";
import { guardarAjustesAction, type PanelState } from "../actions";
import { EstadoPanel } from "../estado-panel";

const inicial: PanelState = { error: null, ok: null };

type Ajustes = {
  pipelinesIncluded: string[];
  signature: string | null;
  voiceNotes: string | null;
  waitDays: number;
  staleDays: number;
};

/**
 * Embudos, voz y plazos, en un solo formulario.
 *
 * Los `name` coinciden con lo que lee `guardarAjustesAction`: un nombre que no coincide no da
 * error, simplemente guarda vacío sin que nadie se entere.
 */
export function AjustesForm({
  embudos,
  avisoEmbudos,
  ajustes,
}: {
  embudos: string[];
  avisoEmbudos: string | null;
  ajustes: Ajustes;
}) {
  const [state, action, guardando] = useActionState(guardarAjustesAction, inicial);
  const elegidos = new Set(ajustes.pipelinesIncluded);

  return (
    <form action={action} className="space-y-6">
      <fieldset className="fo-card space-y-4 p-5">
        <legend className="px-1 text-sm font-semibold">Embudos incluidos</legend>
        <p className="fo-helper">
          Sólo se leen las oportunidades de los embudos que marques. Dejá afuera los que no son de
          venta (colaboradores, talleres, pruebas).
        </p>
        {avisoEmbudos ? (
          <p className="fo-alert-warning rounded-[var(--fo-radius-sm)] p-3 text-sm leading-relaxed">
            {avisoEmbudos}
          </p>
        ) : null}
        {embudos.length > 0 ? (
          <div className="space-y-2">
            {embudos.map((nombre) => (
              <label
                key={nombre}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-[var(--fo-border)] px-3 py-2 text-sm has-[:checked]:border-[var(--fo-accent)] has-[:checked]:bg-[var(--fo-accent-soft)]"
              >
                <input
                  type="checkbox"
                  name="pipelinesIncluded"
                  value={nombre}
                  defaultChecked={elegidos.has(nombre)}
                  className="size-5 shrink-0 accent-[var(--fo-accent)]"
                />
                <span>{nombre}</span>
              </label>
            ))}
          </div>
        ) : null}
      </fieldset>

      <fieldset className="fo-card space-y-4 p-5">
        <legend className="px-1 text-sm font-semibold">Tu voz</legend>
        <p className="fo-helper">
          Con esto el asistente escribe como vos. Las indicaciones se suman a cada análisis.
        </p>
        <label className="fo-field-stack">
          <span className="fo-label">Firma</span>
          <input
            name="signature"
            defaultValue={ajustes.signature ?? ""}
            placeholder="Dani de DNX"
            maxLength={120}
            className="fo-input"
          />
        </label>
        <label className="fo-field-stack">
          <span className="fo-label">Indicaciones</span>
          <textarea
            name="voiceNotes"
            rows={4}
            defaultValue={ajustes.voiceNotes ?? ""}
            placeholder={"Tuteo, nunca voseo.\nNunca ofrezcas descuento de entrada.\nLa seña es del 30 %."}
            maxLength={2000}
            className="fo-input"
          />
        </label>
      </fieldset>

      <fieldset className="fo-card space-y-4 p-5">
        <legend className="px-1 text-sm font-semibold">Plazos</legend>
        <label className="fo-field-stack">
          <span className="fo-label">Días de espera antes de volver a escribir</span>
          <input
            type="number"
            name="waitDays"
            inputMode="numeric"
            defaultValue={ajustes.waitDays}
            min={1}
            max={30}
            className="fo-input"
          />
        </label>
        <label className="fo-field-stack">
          <span className="fo-label">Días sin movimiento para mandarla a «Para cerrar»</span>
          <input
            type="number"
            name="staleDays"
            inputMode="numeric"
            defaultValue={ajustes.staleDays}
            min={30}
            max={365}
            className="fo-input"
          />
        </label>
      </fieldset>

      <EstadoPanel state={state} />

      <div className="fo-card flex flex-wrap items-center gap-3 !p-4">
        <button
          type="submit"
          className="fo-btn fo-btn-primary min-h-11 w-full text-base sm:w-auto"
          disabled={guardando}
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>
        <p className="fo-helper">Guarda los embudos, tu voz y los plazos juntos.</p>
      </div>
    </form>
  );
}
