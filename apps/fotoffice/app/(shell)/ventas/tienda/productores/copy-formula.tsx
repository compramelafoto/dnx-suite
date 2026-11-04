"use client";

import { useState } from "react";

/** La fórmula para pegar en Google Sheets, con un botón para copiarla. */
export function CopyFormula({ formula }: { formula: string }) {
  const [copiada, setCopiada] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="min-w-0 flex-1 break-all rounded border border-[var(--fo-border)] bg-[var(--fo-surface-hover)] px-2 py-1 text-xs">
        {formula}
      </code>
      <button
        type="button"
        className="fo-btn fo-btn-secondary text-sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(formula);
            setCopiada(true);
            setTimeout(() => setCopiada(false), 2000);
          } catch {
            setCopiada(false);
          }
        }}
      >
        {copiada ? "¡Copiada!" : "Copiar fórmula"}
      </button>
    </div>
  );
}
