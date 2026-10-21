"use client";

import { useState } from "react";
import type { ProduccionVista, SalidaVista } from "@/lib/impresion/configuracion";
import { guardarProduccionAction } from "../../impresion/actions";

/**
 * "Se produce en el local": qué pieza es, por qué impresora sale y qué hoja gasta. La foto carnet
 * también puede entregarse como archivo digital: se encuadra igual, pero no gasta impresora ni hoja.
 */
export function ProduccionSection({ productId, produccion, salidas }: { productId: string; produccion: ProduccionVista | null; salidas: SalidaVista[] }) {
  const [tipoPieza, setTipoPieza] = useState<string>(produccion?.tipoPieza ?? "CARNET");
  const [unidad, setUnidad] = useState<string>(produccion?.unidad ?? "HOJA");
  // La foto carnet se cobra por hoja o como archivo digital, y la copia por copia (el servidor también lo exige).
  const esCarnet = tipoPieza === "CARNET";
  const soloCopia = tipoPieza === "COPIA";
  const unidadVigente = soloCopia ? "COPIA" : esCarnet ? (unidad === "ARCHIVO" ? "ARCHIVO" : "HOJA") : unidad === "ARCHIVO" ? "HOJA" : unidad;
  const digital = unidadVigente === "ARCHIVO";
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
              if (e.target.value === "CARNET" && unidad !== "ARCHIVO") setUnidad("HOJA");
              if (e.target.value === "COPIA") setUnidad("COPIA");
            }}
            className="fo-input mt-1"
          >
            <option value="CARNET">Foto carnet</option>
            <option value="COPIA">Copia</option>
            <option value="POLAROID">Polaroid</option>
          </select>
        </label>
        <label className="text-sm">Se cobra por
          <select name="unidad" value={unidadVigente} onChange={(e) => setUnidad(e.target.value)} className="fo-input mt-1">
            <option value="HOJA" disabled={soloCopia}>Hoja / plancha</option>
            <option value="COPIA" disabled={esCarnet}>Copia</option>
            <option value="PIEZA" disabled={esCarnet || soloCopia}>Pieza</option>
            <option value="ARCHIVO" disabled={!esCarnet}>Archivo digital</option>
          </select>
          {esCarnet && !digital ? <span className="mt-1 block text-xs text-[var(--fo-muted)]">La foto carnet impresa se cobra por hoja.</span> : null}
          {digital ? <span className="mt-1 block text-xs text-[var(--fo-muted)]">Se entrega el archivo (descarga o mail): no gasta impresora ni hoja.</span> : null}
          {soloCopia ? <span className="mt-1 block text-xs text-[var(--fo-muted)]">Las copias se cobran por copia: la cantidad del ticket es el total de copias.</span> : null}
        </label>
        {digital ? null : (
          <>
            <label className="text-sm">Impresora
              <select name="salidaId" defaultValue={produccion?.salidaId ?? salidas[0]?.id} className="fo-input mt-1">
                {salidas.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </label>
            <label className="text-sm">Hoja que gasta
              <select name="tamanoHojaId" defaultValue={produccion?.tamanoHojaId ?? undefined} className="fo-input mt-1">
                {salidas.flatMap((s) => s.tamanos.map((t) => <option key={`${s.id}-${t.id}`} value={t.id}>{s.nombre} · {t.nombre}</option>))}
              </select>
            </label>
          </>
        )}
      </div>
      <p className="text-xs text-[var(--fo-muted)]">Ejemplo: «Foto carnet» en la Kodak 305 con hoja 10x15, y «Foto carnet económica» en la Epson L800. Así cada uno registra lo que gasta en su impresora.</p>
      <button type="submit" className="fo-btn fo-btn-primary text-sm">Guardar producción</button>
    </form>
  );
}
