"use client";

import { useState, useTransition } from "react";
import { saveContestRoyaltyAction, type ContestActionResult } from "./actions";
import { ContestResult } from "./contest-result";

export function RoyaltyForm({ contestId, percent }: { contestId: string; percent: string }) {
  const [resultado, setResultado] = useState<ContestActionResult | null>(null);
  const [pendiente, startTransition] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setResultado(null);
        startTransition(async () => setResultado(await saveContestRoyaltyAction(contestId, fd)));
      }}
      className="space-y-3"
    >
      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="concurso-regalia">
          Regalía (%)
        </label>
        <input
          id="concurso-regalia"
          name="royaltyPercent"
          inputMode="decimal"
          defaultValue={percent}
          className="fo-input max-w-[8rem]"
          required
        />
        <p className="fo-helper">Entre 0 y 100. Si no la cambiás, es 20 %.</p>
      </div>
      <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pendiente}>
        {pendiente ? "Guardando…" : "Guardar"}
      </button>
      <ContestResult resultado={resultado} />
    </form>
  );
}
