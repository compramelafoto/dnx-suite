"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { consumoPorRenglon, type LineaReceta } from "@/lib/stock/receta";
import { guardarRecetaAction, sugerirRecetaAction } from "./receta-actions";

type Insumo = { id: string; nombre: string; unidad: string };
type Fila = { insumoId: string; quantity: string; porCada: string };

const aFila = (l: LineaReceta): Fila => ({ insumoId: l.insumoId, quantity: String(l.quantity), porCada: String(l.porCada) });
const entero = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v) : NaN);

/** "Lo que gasta una unidad vendida": cada línea se lee como una frase. */
export function RecetaSection({
  productId,
  receta,
  insumos,
  sugerencia,
}: {
  productId: string;
  receta: LineaReceta[];
  insumos: Insumo[];
  /** Sólo si el producto tiene producción en Impresión. */
  sugerencia: { pideCuantasPorHoja: boolean; piezasPorHoja: number } | null;
}) {
  const router = useRouter();
  const [filas, setFilas] = useState<Fila[]>(receta.map(aFila));
  const [piezas, setPiezas] = useState(String(sugerencia?.piezasPorHoja ?? 1));
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendiente, empezar] = useTransition();
  const porId = new Map(insumos.map((i) => [i.id, i]));

  const cambiar = (n: number, parte: Partial<Fila>) => setFilas((fs) => fs.map((f, i) => (i === n ? { ...f, ...parte } : f)));

  function agregar() {
    const usados = new Set(filas.map((f) => f.insumoId));
    const libre = insumos.find((i) => !usados.has(i.id));
    if (libre) setFilas([...filas, { insumoId: libre.id, quantity: "1", porCada: "1" }]);
  }

  function sugerir() {
    const p = sugerencia?.pideCuantasPorHoja ? entero(piezas) : 1;
    if (!(p >= 1)) return setMensaje({ ok: false, texto: "¿Cuántas entran por hoja? Poné un número entero desde 1." });
    empezar(async () => {
      const lineas = await sugerirRecetaAction(productId, p);
      if (lineas.length === 0) return setMensaje({ ok: false, texto: "La impresora de este producto no tiene consumos cargados para esa hoja." });
      setFilas(lineas.map(aFila));
      setMensaje({ ok: true, texto: "Listo, revisá la receta y tocá «Guardar»." });
    });
  }

  function guardar() {
    const lineas = filas.map((f) => ({ insumoId: f.insumoId, quantity: entero(f.quantity), porCada: entero(f.porCada) }));
    empezar(async () => {
      const r = await guardarRecetaAction(productId, lineas);
      setMensaje(r.ok ? { ok: true, texto: "Listo, se guardó la receta." } : { ok: false, texto: r.error });
      if (r.ok) router.refresh();
    });
  }

  // Ejemplo en vivo: vender 3 con las líneas tal como están escritas ahora.
  const ejemplo = filas
    .map((f) => {
      const q = entero(f.quantity);
      const c = entero(f.porCada);
      const i = porId.get(f.insumoId);
      if (!i || !(q > 0) || !(c >= 1)) return null;
      return `${consumoPorRenglon(3, { quantity: q, porCada: c })} ${i.unidad}`;
    })
    .filter((x): x is string => x !== null);

  return (
    <section className="fo-card space-y-3 p-5">
      <h2 className="text-base font-semibold">Receta de consumo</h2>
      <p className="text-xs text-[var(--fo-muted)]">Lo que gasta una unidad vendida. Se descuenta solo al cobrar y al tomar un pedido.</p>

      {insumos.length === 0 ? (
        <p className="text-sm text-[var(--fo-muted)]">Todavía no cargaste insumos. Creá uno en el catálogo (tipo «Insumo») para armar la receta.</p>
      ) : null}

      {filas.map((f, n) => (
        <div key={n} className="flex flex-wrap items-center gap-2 text-sm">
          <input value={f.quantity} onChange={(e) => cambiar(n, { quantity: e.target.value })} inputMode="numeric" aria-label="Cantidad" className="fo-input" style={{ width: "4.5rem" }} />
          <select value={f.insumoId} onChange={(e) => cambiar(n, { insumoId: e.target.value })} aria-label="Insumo" className="fo-input" style={{ width: "auto", minWidth: "14rem", flex: "1 1 14rem" }}>
            {insumos.map((i) => <option key={i.id} value={i.id}>{i.unidad} · {i.nombre}</option>)}
          </select>
          <span>cada</span>
          <input value={f.porCada} onChange={(e) => cambiar(n, { porCada: e.target.value })} inputMode="numeric" aria-label="Cada cuántas unidades" className="fo-input" style={{ width: "4.5rem" }} />
          <span>unidades vendidas</span>
          <button type="button" onClick={() => setFilas(filas.filter((_, i) => i !== n))} className="fo-btn fo-btn-ghost text-sm">Quitar</button>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={agregar} disabled={filas.length >= insumos.length} className="fo-btn fo-btn-secondary text-sm">Agregar insumo</button>
        {sugerencia ? (
          <>
            {sugerencia.pideCuantasPorHoja ? (
              <label className="flex items-center gap-2 text-sm">¿Cuántas entran por hoja?
                <input value={piezas} onChange={(e) => setPiezas(e.target.value)} inputMode="numeric" className="fo-input" style={{ width: "4.5rem" }} />
              </label>
            ) : null}
            <button type="button" onClick={sugerir} disabled={pendiente} className="fo-btn fo-btn-secondary text-sm">Sugerir desde Impresión</button>
          </>
        ) : null}
      </div>

      {ejemplo.length > 0 ? (
        <p className="text-xs text-[var(--fo-muted)]">
          Vender 3 gasta {ejemplo.join(" y ")} (se redondea para arriba: no se juntan piezas de distintos clientes en una hoja).
        </p>
      ) : null}

      {mensaje ? <p role="status" className={`text-sm ${mensaje.ok ? "text-[var(--fo-success)]" : "text-[var(--fo-danger)]"}`}>{mensaje.texto}</p> : null}
      <button type="button" onClick={guardar} disabled={pendiente} className="fo-btn fo-btn-primary text-sm">Guardar</button>
    </section>
  );
}
