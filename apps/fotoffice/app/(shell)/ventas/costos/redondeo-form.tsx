"use client";

import { useState, useTransition } from "react";
import { formatMinorArs, parseArsToMinor } from "@/lib/membership/money";
import type { TramoRedondeo } from "@/lib/precios-proveedor/redondeo";
import { TRAMOS_POR_OMISION } from "@/lib/precios-proveedor/redondeo";
import { guardarRedondeoAction } from "./actions";

function pesos(minor: number): string {
  return formatMinorArs(minor).replace(/,00$/, "");
}

type Fila = { desde: string; multiplo: string };

function aFilas(tramos: TramoRedondeo[]): Fila[] {
  return tramos.map((t) => ({ desde: String(t.desdeMinor / 100), multiplo: String(t.multiploMinor / 100) }));
}

/** Los tramos de redondeo del workspace. Siempre se redondea hacia arriba. */
export function RedondeoForm({ tramos }: { tramos: TramoRedondeo[] }) {
  const [filas, setFilas] = useState<Fila[]>(() => aFilas(tramos));
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function cambiar(i: number, campo: keyof Fila, valor: string) {
    setFilas((prev) => prev.map((f, j) => (j === i ? { ...f, [campo]: valor } : f)));
  }

  function guardar() {
    const nuevos: TramoRedondeo[] = [];
    for (const f of filas) {
      const desde = parseArsToMinor(f.desde);
      const multiplo = parseArsToMinor(f.multiplo);
      if (desde === null || multiplo === null) {
        setAviso("Algún importe no se entiende.");
        return;
      }
      nuevos.push({ desdeMinor: desde, multiploMinor: multiplo });
    }
    startTransition(async () => {
      const r = await guardarRedondeoAction(nuevos);
      setAviso(r.ok ? "Listo, se guardó. Los precios sugeridos ya usan este redondeo." : r.error);
    });
  }

  return (
    <section className="fo-card space-y-4 p-5">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Redondeo para la caja</h2>
        <p className="fo-helper">
          El precio que sale de costo × margen se redondea siempre hacia arriba al múltiplo indicado, según en qué tramo cae. Así
          se puede dar vuelto con los billetes que circulan.
        </p>
      </div>
      <div className="space-y-2">
        {filas.map((f, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
            <span>Desde $</span>
            <input className="fo-input w-28" inputMode="numeric" value={f.desde} disabled={i === 0} onChange={(e) => cambiar(i, "desde", e.target.value)} aria-label="Desde" />
            <span>redondear al múltiplo de $</span>
            <input className="fo-input w-24" inputMode="numeric" value={f.multiplo} onChange={(e) => cambiar(i, "multiplo", e.target.value)} aria-label="Múltiplo" />
            {i > 0 ? (
              <button type="button" className="fo-btn fo-btn-ghost text-xs" onClick={() => setFilas((prev) => prev.filter((_, j) => j !== i))}>
                Quitar
              </button>
            ) : null}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={() => setFilas((prev) => [...prev, { desde: "", multiplo: "" }])}>
          Agregar tramo
        </button>
        <button type="button" className="fo-btn fo-btn-ghost text-sm" onClick={() => setFilas(aFilas(TRAMOS_POR_OMISION))}>
          Volver a los de siempre ({TRAMOS_POR_OMISION.map((t) => pesos(t.multiploMinor)).join(" / ")})
        </button>
        <button type="button" className="fo-btn fo-btn-primary text-sm" disabled={pendiente} onClick={guardar}>
          {pendiente ? "Guardando…" : "Guardar redondeo"}
        </button>
      </div>
      {aviso ? <p className="text-sm text-[var(--fo-muted)]">{aviso}</p> : null}
    </section>
  );
}
