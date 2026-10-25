import { CAMPO_TRAMPA } from "@/lib/consultas/trampa";

/** El campo trampa (ver `lib/consultas/trampa.ts`): fuera de la vista y de la tabulación. */
export function CampoTrampa() {
  return (
    <div
      aria-hidden="true"
      style={{ position: "absolute", left: "-10000px", top: "auto", width: 1, height: 1, overflow: "hidden" }}
    >
      <label htmlFor={`campo-${CAMPO_TRAMPA}`}>No completar</label>
      <input id={`campo-${CAMPO_TRAMPA}`} name={CAMPO_TRAMPA} type="text" tabIndex={-1} autoComplete="off" data-1p-ignore="true" data-lpignore="true" data-form-type="other" defaultValue="" />
    </div>
  );
}
