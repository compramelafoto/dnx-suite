"use client";

import { useState, useTransition } from "react";
import { markAuthorMonthPaidAction, type RoyaltiesActionResult } from "./actions";

/** "Marcar pagado" de un autor en el mes, con la referencia del pago (transferencia, recibo). */
export function MarkPaidForm({
  authorUserId,
  month,
  amountLabel,
}: {
  authorUserId: number;
  month: string;
  amountLabel: string;
}) {
  const [resultado, setResultado] = useState<RoyaltiesActionResult | null>(null);
  const [pendiente, startTransition] = useTransition();
  const idCampo = `regalia-ref-${authorUserId}`;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setResultado(null);
        startTransition(async () => setResultado(await markAuthorMonthPaidAction(fd)));
      }}
      className="flex flex-wrap items-end gap-2"
    >
      <input type="hidden" name="authorUserId" value={authorUserId} />
      <input type="hidden" name="month" value={month} />
      <div className="fo-field-stack">
        <label className="fo-label" htmlFor={idCampo}>
          Referencia del pago
        </label>
        <input
          id={idCampo}
          name="reference"
          type="text"
          maxLength={120}
          required
          placeholder="Transferencia, recibo…"
          className="fo-input max-w-[18rem]"
        />
      </div>
      <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pendiente}>
        {pendiente ? "Guardando…" : `Marcar pagado (${amountLabel})`}
      </button>
      {resultado ? (
        <p
          className={`w-full text-sm ${resultado.ok ? "text-[var(--fo-success)]" : "text-[var(--fo-danger)]"}`}
          role={resultado.ok ? "status" : "alert"}
        >
          {resultado.ok ? resultado.message : resultado.error}
        </p>
      ) : null}
    </form>
  );
}
