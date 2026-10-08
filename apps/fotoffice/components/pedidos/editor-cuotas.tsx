"use client";

import { ETIQUETA_MEDIO_COBRO, MEDIOS_COBRO, type MedioCobro } from "@/lib/pedidos/constantes";
import { pesosPedido, sumarPesos } from "@/lib/pedidos/pantalla";
import { aCentavos, desdeCentavos, sumarMeses } from "@/lib/pedidos/plan-cuotas";

/** Una fila del editor. `importe` es el texto escrito (se lee al guardar). */
export type FilaCuota = {
  clave: string;
  /** Id de la cuota guardada, o null si es nueva. */
  id: string | null;
  dueDate: string;
  importe: string;
  suggestedMethod: MedioCobro | null;
  /** Lo ya cobrado de la cuota (no se puede quitar y no baja de eso). */
  imputado: number;
};

let contador = 0;
export function claveDeFila(): string {
  contador += 1;
  return `f${contador}-${Math.random().toString(36).slice(2, 8)}`;
}

/** "40000.5" para el input (con punto, como los `type=number`). */
export function textoDeImporte(n: number): string {
  return String(desdeCentavos(aCentavos(n)));
}

/** Importe de una fila (null si no es un número válido mayor que cero con hasta dos decimales). */
export function importeDeFila(f: FilaCuota): number | null {
  const n = Number(f.importe.replace(",", "."));
  if (!f.importe.trim() || !Number.isFinite(n) || n <= 0) return null;
  if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) return null;
  return desdeCentavos(aCentavos(n));
}

/** Lo que viaja al servidor (las reglas de suma y de cuotas con cobros las vuelve a mirar el servidor). */
export function cuotasParaGuardar(filas: readonly FilaCuota[]) {
  return filas.map((f) => ({ id: f.id, dueDate: f.dueDate, amountArs: importeDeFila(f) ?? 0, suggestedMethod: f.suggestedMethod }));
}

/**
 * Editor del plan de cuotas: vencimiento, importe (con centavos) y medio sugerido de cada cuota;
 * agregar y quitar. Muestra cuánto suman contra el total del pedido. Una cuota con cobros no se
 * puede quitar. Controlado: la pantalla guarda las filas.
 */
export function EditorCuotas({
  filas,
  onCambiar,
  total,
  hoy,
  deshabilitado = false,
}: {
  filas: FilaCuota[];
  onCambiar: (filas: FilaCuota[]) => void;
  total: number;
  /** Hoy en Argentina ("aaaa-mm-dd"): el vencimiento de la primera cuota que se agrega. */
  hoy: string;
  deshabilitado?: boolean;
}) {
  const importes = filas.map(importeDeFila);
  const suma = sumarPesos(importes.map((n) => n ?? 0));
  const diferencia = desdeCentavos(aCentavos(total) - aCentavos(suma));

  function cambiar(clave: string, cambio: Partial<FilaCuota>) {
    onCambiar(filas.map((f) => (f.clave === clave ? { ...f, ...cambio } : f)));
  }

  function agregar() {
    const ultima = filas.at(-1);
    const fecha = ultima ? sumarMeses(ultima.dueDate, 1) : hoy;
    onCambiar([
      ...filas,
      { clave: claveDeFila(), id: null, dueDate: fecha, importe: diferencia > 0 ? textoDeImporte(diferencia) : "", suggestedMethod: null, imputado: 0 },
    ]);
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="text-left text-xs text-[var(--fo-muted)]">
              <th className="py-1 pr-2 font-medium">Cuota</th>
              <th className="py-1 pr-2 font-medium">Vence</th>
              <th className="py-1 pr-2 font-medium">Importe</th>
              <th className="py-1 pr-2 font-medium">Medio sugerido</th>
              <th className="py-1 font-medium" />
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={f.clave} className="border-t border-[var(--fo-border)] align-top">
                <td className="py-2 pr-2 tabular-nums">
                  {i + 1}
                  {f.imputado > 0 ? <span className="block text-xs text-[var(--fo-muted)]">Cobrado {pesosPedido(f.imputado)}</span> : null}
                </td>
                <td className="py-2 pr-2">
                  <input
                    type="date"
                    className="fo-input"
                    aria-label={`Vencimiento de la cuota ${i + 1}`}
                    value={f.dueDate}
                    disabled={deshabilitado}
                    onChange={(e) => cambiar(f.clave, { dueDate: e.target.value })}
                    required
                  />
                </td>
                <td className="py-2 pr-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={f.imputado > 0 ? f.imputado : 0.01}
                    step="0.01"
                    className="fo-input w-36 tabular-nums"
                    aria-label={`Importe de la cuota ${i + 1}`}
                    aria-invalid={importes[i] === null}
                    value={f.importe}
                    disabled={deshabilitado}
                    onChange={(e) => cambiar(f.clave, { importe: e.target.value })}
                    required
                  />
                </td>
                <td className="py-2 pr-2">
                  <select
                    className="fo-input"
                    aria-label={`Medio sugerido de la cuota ${i + 1}`}
                    value={f.suggestedMethod ?? ""}
                    disabled={deshabilitado}
                    onChange={(e) => cambiar(f.clave, { suggestedMethod: (e.target.value || null) as MedioCobro | null })}
                  >
                    <option value="">Sin sugerir</option>
                    {MEDIOS_COBRO.map((m) => (
                      <option key={m} value={m}>
                        {ETIQUETA_MEDIO_COBRO[m]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2 text-right">
                  <button
                    type="button"
                    className="fo-btn fo-btn-ghost text-xs"
                    disabled={deshabilitado || f.imputado > 0}
                    title={f.imputado > 0 ? "Una cuota con cobros no se puede quitar." : undefined}
                    aria-label={`Quitar la cuota ${i + 1}`}
                    onClick={() => onCambiar(filas.filter((x) => x.clave !== f.clave))}
                  >
                    Quitar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={agregar} disabled={deshabilitado}>
          Agregar cuota
        </button>
        <p aria-live="polite" className={aCentavos(diferencia) === 0 ? "text-[var(--fo-muted)]" : "text-[var(--fo-danger)]"}>
          Suman {pesosPedido(suma)} de {pesosPedido(total)}
          {aCentavos(diferencia) > 0 ? ` · faltan ${pesosPedido(diferencia)}` : aCentavos(diferencia) < 0 ? ` · sobran ${pesosPedido(-diferencia)}` : ""}
        </p>
      </div>
    </div>
  );
}
