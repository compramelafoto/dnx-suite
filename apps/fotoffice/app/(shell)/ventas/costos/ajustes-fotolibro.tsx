"use client";

import { useState, useTransition } from "react";
import { fotosPorHoja } from "@/lib/fotolibro/cotizar";
import { guardarAjustesFotolibroAction } from "./actions";

/**
 * Margen de los fotolibros y fotos por hoja de cada medida (para sugerir cuántas hojas). Las
 * medidas son las que aparecen en las listas de proveedores aplicadas.
 */
export function AjustesFotolibro({ marginPct, configurado, medidas }: { marginPct: number; configurado: Record<string, number>; medidas: string[] }) {
  const [margen, setMargen] = useState(String(marginPct).replace(".", ","));
  const [fotos, setFotos] = useState<Record<string, string>>(() => Object.fromEntries(medidas.map((m) => [m, String(fotosPorHoja(m, configurado))])));
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function guardar() {
    const m = Number(margen.replace("%", "").replace(",", ".").trim());
    if (!Number.isFinite(m) || m < 0) return setAviso("El margen no se entiende.");
    const porHoja: Record<string, number> = {};
    for (const [medida, t] of Object.entries(fotos)) {
      const n = Number(t);
      if (!Number.isInteger(n) || n <= 0 || n > 200) return setAviso(`Las fotos por hoja de ${medida} no se entienden.`);
      porHoja[medida] = n;
    }
    startTransition(async () => {
      const r = await guardarAjustesFotolibroAction({ marginPct: m, fotosPorHoja: porHoja });
      setAviso(r.ok ? "Listo, se guardó." : r.error);
    });
  }

  return (
    <section className="fo-card space-y-4 p-5">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Fotolibros</h2>
        <p className="fo-helper">
          El precio de un fotolibro es (tapa + hoja × hojas + caja) de la última lista del proveedor, con este margen y el
          redondeo de abajo. Las fotos por hoja sirven para sugerir cuántas hojas lleva según la cantidad de fotos.
        </p>
      </div>
      <label className="flex flex-wrap items-center gap-2 text-sm">
        Margen sobre el costo
        <input className="fo-input w-24 tabular-nums" inputMode="decimal" value={margen} onChange={(e) => setMargen(e.target.value)} aria-label="Margen de fotolibros" />
        % <span className="fo-helper">(200 % = costo × 3)</span>
      </label>
      {medidas.length === 0 ? (
        <p className="fo-helper">Cuando apliques una lista de proveedor con hojas de fotolibro, acá aparecen sus medidas.</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {medidas.map((m) => (
            <label key={m} className="flex items-center gap-1 text-sm">
              <span className="w-14">{m}</span>
              <input
                className="fo-input w-16 tabular-nums"
                inputMode="numeric"
                value={fotos[m] ?? ""}
                onChange={(e) => setFotos((p) => ({ ...p, [m]: e.target.value.replace(/\D/g, "") }))}
                aria-label={`Fotos por hoja en ${m}`}
              />
              <span className="fo-helper">fotos/hoja</span>
            </label>
          ))}
        </div>
      )}
      <div className="flex items-center gap-3">
        <button type="button" className="fo-btn fo-btn-primary text-sm" disabled={pendiente} onClick={guardar}>
          {pendiente ? "Guardando…" : "Guardar fotolibros"}
        </button>
        {aviso ? <p className="text-sm text-[var(--fo-muted)]">{aviso}</p> : null}
      </div>
    </section>
  );
}
