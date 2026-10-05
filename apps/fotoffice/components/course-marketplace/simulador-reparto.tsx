"use client";

import { useMemo, useState } from "react";
import { armarEscenarios } from "@/lib/course-marketplace/escenarios";
import type { BeneficiarioEntrada } from "@/lib/course-marketplace/reparto";

const COLORES = ["#2563eb", "#16a34a", "#d97706", "#9333ea", "#dc2626", "#0891b2", "#4b5563"];

function pesos(centavos: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(centavos / 100);
}

/**
 * "Cómo se reparte": tres escenarios con el mismo motor que después cobra. Lo único estimado
 * es la comisión de Mercado Pago, y lo dice.
 */
export function SimuladorReparto({
  listaCentavos,
  comisionPlataformaBps,
  beneficiarios,
  vendedorId,
  destacarId,
  reventaInicialBps = 2500,
}: {
  listaCentavos: number;
  comisionPlataformaBps: number;
  beneficiarios: BeneficiarioEntrada[];
  vendedorId: string;
  destacarId?: string;
  reventaInicialBps?: number;
}) {
  const [reventaBps, setReventaBps] = useState(reventaInicialBps);
  const escenarios = useMemo(
    () => armarEscenarios({ listaCentavos, comisionPlataformaBps, beneficiarios, vendedorId, reventaBps }),
    [listaCentavos, comisionPlataformaBps, beneficiarios, vendedorId, reventaBps],
  );

  return (
    <section className="fo-card space-y-4" aria-label="Cómo se reparte">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h3 className="text-base font-semibold">Cómo se reparte cada venta</h3>
        <label className="text-sm">
          % para un revendedor (simulación){" "}
          <input
            type="number"
            min={1}
            max={90}
            value={reventaBps / 100}
            onChange={(e) => setReventaBps(Math.round(Number(e.target.value || 0) * 100))}
            className="fo-input inline-block w-20"
          />
        </label>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {escenarios.map((esc) => (
          <article key={esc.clave} className="space-y-2 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] p-3">
            <p className="text-sm font-semibold">{esc.titulo}</p>
            {!esc.ok ? (
              <ul className="list-disc pl-5 text-sm text-[var(--fo-danger)]">
                {esc.errores.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            ) : (
              <>
                <p className="text-sm">
                  Paga el alumno: <strong>{pesos(esc.pagaElAlumno)}</strong>
                </p>
                <div className="flex h-3 overflow-hidden rounded-full" aria-hidden>
                  {esc.filas.map((f, i) => (
                    <div key={f.id} style={{ width: `${(f.bruto / esc.pagaElAlumno) * 100}%`, background: COLORES[i % COLORES.length] }} />
                  ))}
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {esc.filas.map((f, i) => (
                      <tr key={f.id} className={f.id === destacarId ? "font-semibold" : undefined}>
                        <td className="py-0.5">
                          <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: COLORES[i % COLORES.length] }} />
                          {f.nombre}
                        </td>
                        <td className="py-0.5 text-right tabular-nums">
                          {f.mp > 0 ? (
                            <span title={`${pesos(f.bruto)} menos ${pesos(f.mp)} estimados de Mercado Pago`}>{pesos(f.neto)}*</span>
                          ) : (
                            pesos(f.neto)
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </article>
        ))}
      </div>
      <p className="text-xs text-[var(--fo-muted)]">
        * Neto después de la comisión de Mercado Pago, <strong>estimada</strong>: Mercado Pago la descuenta al acreditar.
      </p>
    </section>
  );
}
