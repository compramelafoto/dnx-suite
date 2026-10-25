"use client";

import { useState } from "react";
import { ObraExpositor, type ObraDeExpositor } from "./obra-expositor";
import { botonFino, nota } from "./estilos";

/** "Tus obras" en una muestra: cada obra con su formulario y "Agregar otra obra" mientras haya lugar. */
export function ObrasExpositor({ exhibitorId, activo, tope, cuentan, puedeAgregar, obras }: {
  exhibitorId: string;
  activo: boolean;
  tope: number | null;
  cuentan: number;
  puedeAgregar: boolean;
  obras: ObraDeExpositor[];
}) {
  const [nueva, setNueva] = useState(obras.length === 0 && puedeAgregar);
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--mf-line)] pb-3">
        <h2 className="text-xl">Tus obras</h2>
        {tope != null ? <p className={nota}>{cuentan} de {tope}</p> : null}
      </div>
      {obras.map((o) => <ObraExpositor key={o.id} exhibitorId={exhibitorId} obra={o} activo={activo} />)}
      {nueva ? (
        <ObraExpositor exhibitorId={exhibitorId} obra={null} activo={activo} alGuardar={() => setNueva(false)} />
      ) : puedeAgregar ? (
        <p><button type="button" className={botonFino} onClick={() => setNueva(true)}>Agregar otra obra</button></p>
      ) : null}
    </section>
  );
}
