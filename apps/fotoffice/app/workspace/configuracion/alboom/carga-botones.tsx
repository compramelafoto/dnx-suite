"use client";

import { useActionState, useState } from "react";
import { cancelarCargaAction, cargarAction, simularCargaAction } from "./actions";
import { ESTADO_INICIAL } from "./estado";
import { MensajeAlboom } from "./mensaje";

/** Elegir qué partes simular (por omisión, todas las de esta etapa). Las dependencias se suman solas en el servidor. */
export function Simular({ partes }: { partes: { clave: string; nombre: string }[] }) {
  const [estado, enviar, pendiente] = useActionState(simularCargaAction, ESTADO_INICIAL);
  return (
    <form action={enviar} className="space-y-3">
      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-medium">Qué cargar</legend>
        {partes.map((p) => (
          <label key={p.clave} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="entidad" value={p.clave} defaultChecked />
            {p.nombre}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pendiente}>
          Simular
        </button>
        <MensajeAlboom estado={estado} />
      </div>
    </form>
  );
}

export function Cargar() {
  const [abierto, setAbierto] = useState(false);
  const [estado, enviar, pendiente] = useActionState(cargarAction, ESTADO_INICIAL);
  if (!abierto) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setAbierto(true)} className="fo-btn fo-btn-secondary text-sm">
          Cargar
        </button>
        <MensajeAlboom estado={estado} />
      </div>
    );
  }
  return (
    <form action={enviar} className="space-y-2">
      <p className="text-sm">
        Se carga exactamente lo simulado: se crean y completan registros en FotoOffice. Lo que ya existe no se duplica y lo
        que editaste en FotoOffice no se pisa. En Alboom no cambia nada. Escribí CARGAR para confirmar.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <input name="confirmacion" required className="fo-input w-32" aria-label="Escribí CARGAR para confirmar" autoComplete="off" />
        <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pendiente}>
          Cargar
        </button>
        <button type="button" onClick={() => setAbierto(false)} className="text-sm text-[var(--fo-muted)] underline underline-offset-4">
          No
        </button>
        <MensajeAlboom estado={estado} />
      </div>
    </form>
  );
}

export function CancelarCarga() {
  const [estado, enviar, pendiente] = useActionState(cancelarCargaAction, ESTADO_INICIAL);
  return (
    <form action={enviar} className="flex flex-wrap items-center gap-3">
      <button type="submit" className="fo-btn fo-btn-secondary text-sm" disabled={pendiente}>
        Cancelar
      </button>
      <MensajeAlboom estado={estado} />
    </form>
  );
}
