"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { guardarComisionesAction } from "./actions";

type Fila = { userId: number; nombre: string; email: string };
type Regla = { userId: number; porcentaje: number; activa: boolean };

/** Quién del equipo cobra comisión por vender fotolibros, y qué porcentaje del precio de venta. */
export function AjustesComisiones({ equipo, reglas }: { equipo: Fila[]; reglas: Regla[] }) {
  const router = useRouter();
  const inicial = new Map(reglas.map((r) => [r.userId, r]));
  const [estado, setEstado] = useState<Record<number, { activa: boolean; porcentaje: string }>>(() =>
    Object.fromEntries(equipo.map((m) => [m.userId, { activa: inicial.get(m.userId)?.activa ?? false, porcentaje: String(inicial.get(m.userId)?.porcentaje ?? 10).replace(".", ",") }])),
  );
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, startTransition] = useTransition();

  function guardar() {
    setAviso(null);
    const lista = equipo
      .filter((m) => estado[m.userId]!.activa || inicial.has(m.userId))
      .map((m) => ({ userId: m.userId, activa: estado[m.userId]!.activa, porcentaje: Number(estado[m.userId]!.porcentaje.replace(",", ".")) }));
    startTransition(async () => {
      const r = await guardarComisionesAction(lista);
      setAviso(r.ok ? "Guardado." : r.error);
      if (r.ok) router.refresh();
    });
  }

  return (
    <section className="fo-card space-y-3 p-4">
      <div>
        <h2 className="font-semibold">Quién cobra comisión</h2>
        <p className="fo-helper">Cuenta desde que se enciende: lo vendido antes no suma. El porcentaje se calcula sobre el precio de venta.</p>
      </div>
      <ul className="divide-y divide-[var(--fo-border)]">
        {equipo.map((m) => (
          <li key={m.userId} className="flex flex-wrap items-center justify-between gap-3 py-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={estado[m.userId]!.activa}
                onChange={(e) => setEstado((s) => ({ ...s, [m.userId]: { ...s[m.userId]!, activa: e.target.checked } }))}
              />
              <span>
                <span className="font-medium">{m.nombre}</span>
                {m.nombre !== m.email ? <span className="ml-2 text-xs text-[var(--fo-muted)]">{m.email}</span> : null}
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                className="fo-input h-8 w-20 text-right tabular-nums"
                inputMode="decimal"
                aria-label={`Porcentaje de ${m.nombre}`}
                value={estado[m.userId]!.porcentaje}
                onChange={(e) => setEstado((s) => ({ ...s, [m.userId]: { ...s[m.userId]!, porcentaje: e.target.value.replace(/[^\d,]/g, "") } }))}
              />
              %
            </label>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3">
        <button type="button" className="fo-btn fo-btn-primary text-sm" disabled={guardando} onClick={guardar}>
          {guardando ? "Guardando…" : "Guardar"}
        </button>
        {aviso ? <span className="text-sm">{aviso}</span> : null}
      </div>
    </section>
  );
}
