"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { issuePrepaidCardAction } from "@/app/actions/issue-prepaid-card";
import type { PrepaidUnissued } from "@/lib/carnet/prepaid-unissued";

/**
 * Tarjetas que el socio ya pagó y nadie emitió.
 *
 * Se emiten de a una y con confirmación: cada una entra a la cola de impresión y le avisa al
 * socio, así que no es algo para hacer en tanda sin mirar.
 */
export function PrepaidSection({ rows }: { rows: PrepaidUnissued[] }) {
  const router = useRouter();
  const [enCurso, setEnCurso] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (rows.length === 0) return null;

  return (
    <section className="fo-card space-y-3 p-5">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">Tarjetas pagadas sin emitir</h2>
        <p className="text-xs text-[var(--fo-muted)] leading-relaxed">
          Ya están pagas. Al emitirlas entran directo a «Para imprimir», sin generar ningún cobro.
        </p>
      </div>
      <ul className="divide-y divide-[var(--fo-border)]">
        {rows.map((r) => (
          <li key={r.memberId} className="flex items-center justify-between gap-3 py-2.5">
            <div className="space-y-0.5">
              <p className="text-sm">
                {r.fullName} <span className="text-[var(--fo-muted)]">· N° {r.memberNumber}</span>
              </p>
              {!r.hasPhoto ? (
                <p className="text-xs text-[var(--fo-warning)]">
                  Falta la foto: cargala en su ficha para poder emitirla.
                </p>
              ) : null}
            </div>
            <button
              type="button"
              className="fo-btn fo-btn-primary text-xs disabled:opacity-60"
              disabled={!r.hasPhoto || enCurso !== null}
              onClick={() => {
                if (!window.confirm(`¿Emitir la tarjeta impresa de ${r.fullName}?`)) return;
                setEnCurso(r.memberId);
                setError(null);
                setMensaje(null);
                startTransition(async () => {
                  const res = await issuePrepaidCardAction(r.memberId);
                  setEnCurso(null);
                  if (!res.ok) {
                    setError(res.error);
                    return;
                  }
                  setMensaje(`Emitida la tarjeta ${res.cardNumber} de ${r.fullName}.`);
                  router.refresh();
                });
              }}
            >
              {enCurso === r.memberId ? "Emitiendo…" : "Emitir"}
            </button>
          </li>
        ))}
      </ul>
      {mensaje ? <p className="text-xs text-[var(--fo-success)]">{mensaje}</p> : null}
      {error ? (
        <p className="text-xs text-[var(--fo-danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
