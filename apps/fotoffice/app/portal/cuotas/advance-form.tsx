"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { advanceDuesAction } from "@/app/actions/advance-dues";

/**
 * Adelantar cuotas.
 *
 * Se elige cuántos meses, no un importe: el socio ve exactamente qué está comprando y a qué
 * precio antes de confirmar. Pedirle un monto libre es lo que dejaba sobrantes flotando.
 */
export function AdvanceForm({
  options,
}: {
  options: { months: number; label: string; totalLabel: string }[];
}) {
  const router = useRouter();
  const [elegido, setElegido] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  if (options.length === 0) return null;

  return (
    <section className="fo-card space-y-3 p-5">
      <h2 className="text-sm font-semibold">Adelantar cuotas</h2>
      <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
        Elegís los meses y se crean esas cuotas al valor vigente de cada una: si la
        institución ya resolvió un aumento para más adelante, esos meses ya lo tienen; el
        resto queda al valor de hoy, congelado aunque suba después. Se pagan con el botón de
        pago de siempre, ahí abajo.
      </p>
      <ul className="space-y-2">
        {options.map((o) => (
          <li key={o.months}>
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[var(--fo-radius)] border border-[var(--fo-border)] p-3 text-sm hover:border-[var(--fo-accent)]">
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="months"
                  checked={elegido === o.months}
                  onChange={() => setElegido(o.months)}
                />
                {o.label}
              </span>
              <span className="font-medium tabular-nums">{o.totalLabel}</span>
            </label>
          </li>
        ))}
      </ul>
      {error ? (
        <p className="text-xs text-[var(--fo-danger)]" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        className="fo-btn fo-btn-primary w-full text-sm disabled:opacity-60"
        disabled={pendiente || elegido === null}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const r = await advanceDuesAction(elegido ?? 0);
            if (!r.ok) {
              setError(r.error);
              return;
            }
            router.push(r.payPath);
          })
        }
      >
        {pendiente ? "Creando las cuotas…" : "Adelantar cuotas"}
      </button>
    </section>
  );
}
