"use client";

import { useState, useTransition } from "react";
import { savePrintSettingsAction, type FormatsActionResult } from "./actions";
import { FormatsResult } from "./formats-result";

export function PrintSettingsForm({ minDpi }: { minDpi: number }) {
  const [resultado, setResultado] = useState<FormatsActionResult | null>(null);
  const [pendiente, startTransition] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setResultado(null);
        startTransition(async () => setResultado(await savePrintSettingsAction(fd)));
      }}
      className="space-y-3"
    >
      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="formatos-minDpi">
          Resolución mínima (dpi)
        </label>
        <input id="formatos-minDpi" name="minDpi" type="number" min={72} max={600} step={1} defaultValue={minDpi} className="fo-input max-w-[10rem]" required />
        <p className="fo-helper">
          Entre 72 y 600. Una obra sólo se ofrece en los formatos que su archivo original alcanza a cubrir con esta calidad.
          150 es lo habitual para copias y cuadros.
        </p>
      </div>
      <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pendiente}>
        {pendiente ? "Guardando…" : "Guardar"}
      </button>
      <FormatsResult resultado={resultado} />
    </form>
  );
}
