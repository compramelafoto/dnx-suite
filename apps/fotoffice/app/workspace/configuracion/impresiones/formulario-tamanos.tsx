"use client";

import { useState, useTransition } from "react";
import { parsearMontoAr } from "@/lib/impresiones/precios";
import { guardarTamanosAction } from "./actions";

type Fila = { id: string; widthCm: number; heightCm: number; proveedorId: string | null; costArs: string; priceArs: string; active: boolean };

const num = (v: string) => parsearMontoAr(v) ?? 0;
const pesos = (n: number) => n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });

export function FormularioTamanos({ inicial, proveedores }: { inicial: Fila[]; proveedores: { id: string; name: string }[] }) {
  const [filas, setFilas] = useState(inicial);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pendiente, empezar] = useTransition();
  const cambiar = (id: string, cambio: Partial<Fila>) => setFilas((fs) => fs.map((f) => (f.id === id ? { ...f, ...cambio } : f)));

  function guardar() {
    setMensaje(null);
    empezar(async () => {
      const r = await guardarTamanosAction(filas);
      setMensaje(r.ok ? { ok: true, texto: "Guardado." } : { ok: false, texto: r.error });
    });
  }

  return (
    <div className="fo-card space-y-4 p-5">
      <h2 className="text-base font-semibold">Tamaños, costos y precios</h2>
      <p className="text-xs text-[var(--fo-muted)]">Un tamaño sin precio no se ofrece al cliente. La ganancia es precio menos costo, por copia.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-[var(--fo-muted)]">
              <th className="pb-2 pr-2">Medida (cm)</th>
              <th className="pb-2 pr-2">Laboratorio</th>
              <th className="pb-2 pr-2">Costo</th>
              <th className="pb-2 pr-2">Precio</th>
              <th className="pb-2 pr-2">Ganancia</th>
              <th className="pb-2">Activo</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const ganancia = num(f.priceArs) - num(f.costArs);
              return (
                <tr key={f.id} className="border-t border-[var(--fo-border)]">
                  <td className="py-2 pr-2 font-medium">
                    {f.widthCm} × {f.heightCm}
                  </td>
                  <td className="py-2 pr-2">
                    <select value={f.proveedorId ?? ""} onChange={(e) => cambiar(f.id, { proveedorId: e.target.value || null })} className="fo-input" aria-label="Laboratorio">
                      <option value="">Sin laboratorio</option>
                      {proveedores.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-2">
                    <input value={f.costArs} onChange={(e) => cambiar(f.id, { costArs: e.target.value })} inputMode="decimal" className="fo-input w-28" aria-label="Costo" />
                  </td>
                  <td className="py-2 pr-2">
                    <input value={f.priceArs} onChange={(e) => cambiar(f.id, { priceArs: e.target.value })} inputMode="decimal" className="fo-input w-28" aria-label="Precio" />
                  </td>
                  <td className={`py-2 pr-2 tabular-nums ${ganancia < 0 ? "text-[var(--fo-danger)]" : ""}`}>{f.priceArs.trim() === "" ? "—" : pesos(ganancia)}</td>
                  <td className="py-2">
                    <input type="checkbox" checked={f.active} onChange={(e) => cambiar(f.id, { active: e.target.checked })} aria-label="Activo" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={guardar} disabled={pendiente} className="fo-btn fo-btn-primary text-sm">
          {pendiente ? "Guardando…" : "Guardar"}
        </button>
        {mensaje ? <span className={`text-sm ${mensaje.ok ? "text-[var(--fo-success)]" : "text-[var(--fo-danger)]"}`}>{mensaje.texto}</span> : null}
      </div>
    </div>
  );
}
