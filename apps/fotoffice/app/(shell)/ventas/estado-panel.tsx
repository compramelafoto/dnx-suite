import type { PanelState } from "./actions";

/**
 * Los tres carteles que puede devolver una acción: error, aviso a medias y listo.
 *
 * Mismo trío que Coberturas (`warn` es para lo que salió pero con un "pero"), en un solo lugar
 * para que las tarjetas y los formularios no los dibujen cada uno a su manera.
 */
export function EstadoPanel({ state }: { state: PanelState }) {
  return (
    <>
      {state.error ? (
        <p
          role="alert"
          className="fo-alert-error rounded-[var(--fo-radius-sm)] p-3 text-sm leading-relaxed text-[var(--fo-danger)]"
        >
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="fo-alert-success rounded-[var(--fo-radius-sm)] p-3 text-sm leading-relaxed">
          {state.ok}
        </p>
      ) : null}
      {state.warn ? (
        <p role="status" className="fo-alert-warning rounded-[var(--fo-radius-sm)] p-3 text-sm leading-relaxed">
          {state.warn}
        </p>
      ) : null}
    </>
  );
}
