"use client";

import { useMemo, useState, useTransition } from "react";
import { ETIQUETA_FORMA, FORMAS_ENTREGA, type EntregaProducto, type FormaEntrega } from "@/lib/stock/embalaje";
import { guardarEntregasAction } from "./actions";

type Producto = { id: string; nombre: string; categoria: string | null; entrega: EntregaProducto | null; sugerida: EntregaProducto | null };
type Fila = { forma: FormaEntrega | ""; ancho: string; alto: string; siguiente: boolean; fijo: string; sugerida: boolean; tocada: boolean };

const aFila = (e: EntregaProducto | null, sugerida: boolean): Fila => ({
  forma: e?.forma ?? "",
  ancho: e?.anchoCm != null ? String(e.anchoCm).replace(".", ",") : "",
  alto: e?.altoCm != null ? String(e.altoCm).replace(".", ",") : "",
  siguiente: e?.embalajeSiguiente ?? false,
  fijo: e?.embalajeFijoId ?? "",
  sugerida,
  tocada: false,
});

/**
 * La forma de entrega de cada producto. Lo que no está configurado aparece con la sugerencia
 * precargada y marcada «sugerido»; nada se guarda hasta tocar «Guardar».
 */
export function TablaEntregas({ productos, envoltorios }: { productos: Producto[]; envoltorios: { filaId: string; nombre: string }[] }) {
  const inicial = useMemo(
    () => Object.fromEntries(productos.map((p) => [p.id, p.entrega ? aFila(p.entrega, false) : aFila(p.sugerida, p.sugerida !== null)])),
    [productos],
  );
  const [filas, setFilas] = useState<Record<string, Fila>>(inicial);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();
  const [soloSinConfigurar, setSoloSinConfigurar] = useState(false);

  const cambiar = (id: string, cambio: Partial<Fila>) => setFilas((f) => ({ ...f, [id]: { ...f[id]!, ...cambio, tocada: true } }));

  // Se guardan las filas tocadas y las sugerencias (que todavía no existen en la base).
  const aGuardar = productos.filter((p) => {
    const f = filas[p.id]!;
    return f.tocada || (f.sugerida && f.forma !== "");
  });

  function guardar() {
    setMensaje(null);
    iniciar(async () => {
      const r = await guardarEntregasAction(
        aGuardar.map((p) => {
          const f = filas[p.id]!;
          return {
            productId: p.id,
            forma: f.forma === "" ? null : f.forma,
            anchoCm: f.ancho,
            altoCm: f.alto,
            embalajeSiguiente: f.siguiente,
            embalajeFijoId: f.fijo || null,
          };
        }),
      );
      if (r.ok) {
        setFilas((actual) => Object.fromEntries(Object.entries(actual).map(([id, f]) => [id, { ...f, sugerida: false, tocada: false }])));
        setMensaje({ ok: true, texto: `Listo, se guardaron ${r.guardadas} productos.` });
      } else {
        setMensaje({ ok: false, texto: r.error });
      }
    });
  }

  const visibles = soloSinConfigurar ? productos.filter((p) => !p.entrega) : productos;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-[var(--fo-muted)]">
          <input type="checkbox" checked={soloSinConfigurar} onChange={(e) => setSoloSinConfigurar(e.target.checked)} />
          Ver sólo los que faltan configurar
        </label>
        <button type="button" className="fo-btn fo-btn-primary text-sm" disabled={pendiente || aGuardar.length === 0} onClick={guardar}>
          {pendiente ? "Guardando…" : `Guardar${aGuardar.length > 0 ? ` (${aGuardar.length})` : ""}`}
        </button>
      </div>
      {mensaje ? (
        <p className={`text-sm ${mensaje.ok ? "text-[var(--fo-success)]" : "text-[var(--fo-danger)]"}`} role="status">
          {mensaje.texto}
        </p>
      ) : null}
      <div className="fo-card overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-left text-[var(--fo-muted)]">
            <tr>
              <th className="p-3 font-medium">Producto</th>
              <th className="p-3 font-medium">Cómo se entrega</th>
              <th className="p-3 font-medium">Medida (cm)</th>
              <th className="p-3 font-medium">Bolsa más grande</th>
              <th className="p-3 font-medium">Siempre en</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((p) => {
              const f = filas[p.id]!;
              return (
                <tr key={p.id} className="border-t border-[var(--fo-border)]">
                  <td className="p-3">
                    <span className="text-[var(--fo-text)]">{p.nombre}</span>
                    {f.sugerida && !f.tocada ? <span className="ml-2 rounded border border-[var(--fo-border)] px-1.5 py-0.5 text-xs text-[var(--fo-muted)]">sugerido</span> : null}
                    {p.categoria ? <span className="block text-xs text-[var(--fo-muted)]">{p.categoria}</span> : null}
                  </td>
                  <td className="p-3">
                    <select
                      className="fo-input"
                      value={f.forma}
                      aria-label={`Cómo se entrega ${p.nombre}`}
                      onChange={(e) => cambiar(p.id, { forma: e.target.value as FormaEntrega | "", siguiente: e.target.value === "ENMARCADO" ? true : f.siguiente })}
                    >
                      <option value="">Sin configurar</option>
                      {FORMAS_ENTREGA.map((forma) => (
                        <option key={forma} value={forma}>
                          {ETIQUETA_FORMA[forma]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      <input className="fo-input w-16" inputMode="decimal" value={f.ancho} aria-label="Ancho en cm" onChange={(e) => cambiar(p.id, { ancho: e.target.value })} />
                      <span className="text-[var(--fo-muted)]">x</span>
                      <input className="fo-input w-16" inputMode="decimal" value={f.alto} aria-label="Alto en cm" onChange={(e) => cambiar(p.id, { alto: e.target.value })} />
                    </div>
                  </td>
                  <td className="p-3">
                    <input type="checkbox" checked={f.siguiente} aria-label="Necesita una bolsa más grande que su medida" onChange={(e) => cambiar(p.id, { siguiente: e.target.checked })} />
                  </td>
                  <td className="p-3">
                    <select className="fo-input" value={f.fijo} aria-label="Envoltorio fijo" onChange={(e) => cambiar(p.id, { fijo: e.target.value })}>
                      <option value="">Según la medida</option>
                      {envoltorios.map((e) => (
                        <option key={e.filaId} value={e.filaId}>
                          {e.nombre}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
