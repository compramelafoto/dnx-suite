"use client";

import { useState, useTransition } from "react";
import { generateDuesAction } from "@/app/actions/generate-dues";

/**
 * Genera las cuotas de un mes.
 *
 * El período se puede elegir para poder emitir un mes atrasado: la SFPR arranca con el
 * padrón importado y sin ninguna cuota, así que la primera vez hay que generar hacia atrás.
 */
export function GenerateDuesButton({ defaultPeriod }: { defaultPeriod: string }) {
  const [period, setPeriod] = useState(defaultPeriod);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="space-y-1 text-xs">
          <span className="text-[var(--fo-muted-soft)]">Mes</span>
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="fo-input"
          />
        </label>
        <button
          type="button"
          disabled={pendiente}
          onClick={() =>
            startTransition(async () => {
              setMensaje(null);
              setError(null);
              const data = new FormData();
              data.set("period", period);
              const r = await generateDuesAction(data);
              if (!r.ok) {
                setError(r.error);
                return;
              }
              const detalles = Object.entries(r.motivos)
                .map(([motivo, cuantos]) => `${cuantos} ${motivo}`)
                .join(", ");
              setMensaje(
                r.creadas === 0 && r.yaExistian > 0
                  ? `Las cuotas de ${r.period} ya estaban generadas (${r.yaExistian}).`
                  : `Se generaron ${r.creadas} cuotas de ${r.period}.` +
                      (r.yaExistian > 0 ? ` Ya existían: ${r.yaExistian}.` : "") +
                      (detalles ? ` Sin cuota: ${detalles}.` : ""),
              );
            })
          }
          className="fo-btn fo-btn-primary text-xs disabled:opacity-60"
        >
          {pendiente ? "Generando…" : "Generar cuotas del mes"}
        </button>
      </div>
      {mensaje ? <p className="text-xs text-[var(--fo-success)]">{mensaje}</p> : null}
      {error ? (
        <p className="text-xs text-[var(--fo-danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
