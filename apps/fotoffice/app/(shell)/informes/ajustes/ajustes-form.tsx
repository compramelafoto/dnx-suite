"use client";

import { useState, useTransition } from "react";
import { guardarAjustesInformesAction } from "@/app/actions/informes";

type Inicial = { minBalanceArs: string; monotributoCategory: string; monotributoCapArs: string; monotributoWarnPct: string };

const AYUDA_IMPORTE = "Ej.: 1.234.567,89 (punto para los miles, coma para los centavos). Dejalo vacío si no querés usarlo.";

/** Saldo mínimo de alerta y datos del monotributo (categoría, tope anual y porcentaje de aviso). */
export function AjustesInformesForm({ inicial }: { inicial: Inicial }) {
  const [pendiente, iniciar] = useTransition();
  const [v, setV] = useState(inicial);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    iniciar(async () => {
      try {
        const r = await guardarAjustesInformesAction({
          minBalanceArs: v.minBalanceArs,
          monotributoCategory: v.monotributoCategory,
          monotributoCapArs: v.monotributoCapArs,
          monotributoWarnPct: v.monotributoWarnPct,
        });
        if (!r.ok) return setError(r.error);
        setOk("Guardado.");
      } catch {
        setError("No pudimos guardar los cambios. Probá de nuevo en un rato.");
      }
    });
  }

  return (
    <form onSubmit={guardar} className="space-y-6" aria-label="Ajustes de Informes">
      <section className="fo-card space-y-4 p-5" aria-labelledby="aj-flujo">
        <div className="space-y-1">
          <h2 id="aj-flujo" className="text-base font-semibold">Flujo de caja</h2>
          <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
            Si el saldo proyectado baja de este monto, la fila se marca en rojo y el Tablero te avisa desde qué fecha.
          </p>
        </div>
        <div className="fo-field-stack max-w-xs">
          <label className="fo-label" htmlFor="aj-minimo">Saldo mínimo de alerta ($)</label>
          <input id="aj-minimo" className="fo-input" inputMode="decimal" placeholder="Ej.: 1.234.567,89" value={v.minBalanceArs} onChange={(e) => setV({ ...v, minBalanceArs: e.target.value })} aria-describedby="aj-minimo-ayuda" />
          <p id="aj-minimo-ayuda" className="text-xs text-[var(--fo-muted)]">{AYUDA_IMPORTE}</p>
        </div>
      </section>

      <section className="fo-card space-y-4 p-5" aria-labelledby="aj-mono">
        <div className="space-y-1">
          <h2 id="aj-mono" className="text-base font-semibold">Monotributo</h2>
          <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
            Control interno con lo registrado en Caja. Cargá el tope anual de tu categoría a mano: no se actualiza solo.
          </p>
        </div>
        <div className="fo-field-stack max-w-xs">
          <label className="fo-label" htmlFor="aj-categoria">Categoría</label>
          <input id="aj-categoria" className="fo-input" maxLength={20} placeholder="Ej.: C" value={v.monotributoCategory} onChange={(e) => setV({ ...v, monotributoCategory: e.target.value })} />
        </div>
        <div className="fo-field-stack max-w-xs">
          <label className="fo-label" htmlFor="aj-tope">Tope anual ($)</label>
          <input id="aj-tope" className="fo-input" inputMode="decimal" placeholder="Ej.: 1.234.567,89" value={v.monotributoCapArs} onChange={(e) => setV({ ...v, monotributoCapArs: e.target.value })} aria-describedby="aj-tope-ayuda" />
          <p id="aj-tope-ayuda" className="text-xs text-[var(--fo-muted)]">{AYUDA_IMPORTE}</p>
        </div>
        <div className="fo-field-stack max-w-xs">
          <label className="fo-label" htmlFor="aj-aviso">Avisar desde el (%)</label>
          <input id="aj-aviso" className="fo-input" type="number" inputMode="numeric" min={50} max={99} step={1} value={v.monotributoWarnPct} onChange={(e) => setV({ ...v, monotributoWarnPct: e.target.value })} aria-describedby="aj-aviso-ayuda" />
          <p id="aj-aviso-ayuda" className="text-xs text-[var(--fo-muted)]">Un número entero entre 50 y 99. Por omisión, 80.</p>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pendiente}>
          {pendiente ? "Guardando…" : "Guardar"}
        </button>
        {ok ? <p role="status" className="text-sm text-[var(--fo-success)]">{ok}</p> : null}
        {error ? <p role="alert" className="text-sm text-[var(--fo-danger)]">{error}</p> : null}
      </div>
    </form>
  );
}
