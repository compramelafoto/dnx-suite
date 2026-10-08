"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { advanceDuesAction, cancelAdvanceAction } from "@/app/actions/advance-dues";

/**
 * Adelantar cuotas.
 *
 * Se elige cuántos meses, no un importe: el socio ve exactamente qué está comprando y a qué
 * precio antes de confirmar. Pedirle un monto libre es lo que dejaba sobrantes flotando.
 */
export function AdvanceForm({
  options,
  pending,
}: {
  options: { months: number; label: string; totalLabel: string }[];
  /** Cuotas adelantadas pedidas y sin pagar. Si hay, se ofrece quitarlas en vez de pedir más. */
  pending: {
    count: number;
    firstLabel: string;
    lastLabel: string;
    totalLabel: string;
  } | null;
}) {
  const router = useRouter();
  const [elegido, setElegido] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  /*
    Pedir un adelanto crea las cuotas en el momento, antes de pagarlas. Si el socio ya tiene
    un pedido sin pagar no se le ofrece otro —apilarlos era lo que hacía crecer la deuda con
    cada toque— y se le da la salida: pagarlo con el botón de siempre o quitarlo.
  */
  if (pending) {
    const rango =
      pending.count === 1 ? pending.firstLabel : `de ${pending.firstLabel} a ${pending.lastLabel}`;
    return (
      <section className="fo-card space-y-3 p-5">
        <h2 className="text-sm font-semibold">Cuotas adelantadas sin pagar</h2>
        <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
          Pediste adelantar {pending.count === 1 ? "1 cuota" : `${pending.count} cuotas`} ({rango})
          por {pending.totalLabel}. Ya están sumadas en lo que debés. Si fue un error o cambiaste de
          idea, podés quitarlas: las cuotas que ya debías no se tocan.
        </p>
        {error ? (
          <p className="text-xs text-[var(--fo-danger)]" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          className="fo-btn w-full text-sm disabled:opacity-60"
          disabled={pendiente}
          onClick={() => {
            if (
              !window.confirm(
                `¿Quitar ${pending.count === 1 ? "la cuota adelantada" : `las ${pending.count} cuotas adelantadas`} sin pagar?`,
              )
            )
              return;
            startTransition(async () => {
              setError(null);
              const r = await cancelAdvanceAction();
              if (!r.ok) {
                setError(r.error);
                return;
              }
              router.refresh();
            });
          }}
        >
          {pendiente ? "Quitando…" : "Quitar las cuotas adelantadas"}
        </button>
      </section>
    );
  }

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
