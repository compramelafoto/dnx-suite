"use client";

import { useState } from "react";
import type { ProduccionVista, SalidaVista } from "@/lib/impresion/configuracion";
import { guardarProduccionAction } from "../../impresion/actions";

/** "Se produce en el local": qué pieza es, por qué impresora sale y qué hoja gasta. */
export function ProduccionSection({ productId, produccion, salidas }: { productId: string; produccion: ProduccionVista | null; salidas: SalidaVista[] }) {
  const [tipoPieza, setTipoPieza] = useState<string>(produccion?.tipoPieza ?? "CARNET");
  const [unidad, setUnidad] = useState<string>(produccion?.unidad ?? "HOJA");
  // Etapa 1: la foto carnet sólo se cobra por hoja (el servidor también lo exige).
  const soloHoja = tipoPieza === "CARNET";
  return (
    <form action={guardarProduccionAction} className="fo-card space-y-3 p-5">
      <input type="hidden" name="productId" value={productId} />
      <h2 className="text-base font-semibold">Producción en el local</h2>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="activo" defaultChecked={produccion !== null} /> Se produce en el local (carnet, copias instantáneas)
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Qué es
          <select
            name="tipoPieza"
            value={tipoPieza}
            onChange={(e) => {
              setTipoPieza(e.target.value);
              if (e.target.value === "CARNET") setUnidad("HOJA");
            }}
            className="fo-input mt-1"
          >
            <option value="CARNET">Foto carnet</option>
            <option value="COPIA">Copia</option>
            <option value="POLAROID">Polaroid</option>
          </select>
        </label>
        <label className="text-sm">Se cobra por
          <select name="unidad" value={soloHoja ? "HOJA" : unidad} onChange={(e) => setUnidad(e.target.value)} className="fo-input mt-1">
            <option value="HOJA">Hoja / plancha</option>
            <option value="COPIA" disabled={soloHoja}>Copia</option>
            <option value="PIEZA" disabled={soloHoja}>Pieza</option>
          </select>
          {soloHoja ? <span className="mt-1 block text-xs text-[var(--fo-muted)]">La foto carnet se cobra por hoja. Por foto llega en la etapa 2.</span> : null}
        </label>
        <label className="text-sm">Impresora
          <select name="salidaId" defaultValue={produccion?.salidaId ?? salidas[0]?.id} className="fo-input mt-1">
            {salidas.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </label>
        <label className="text-sm">Hoja que gasta
          <select name="tamanoHojaId" defaultValue={produccion?.tamanoHojaId} className="fo-input mt-1">
            {salidas.flatMap((s) => s.tamanos.map((t) => <option key={`${s.id}-${t.id}`} value={t.id}>{s.nombre} · {t.nombre}</option>))}
          </select>
        </label>
      </div>
      <p className="text-xs text-[var(--fo-muted)]">Ejemplo: «Foto carnet» en la Kodak 305 con hoja 10x15, y «Foto carnet económica» en la Epson L800. Así cada uno registra lo que gasta en su impresora.</p>
      <button type="submit" className="fo-btn fo-btn-primary text-sm">Guardar producción</button>
    </form>
  );
}
