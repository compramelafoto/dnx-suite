"use client";

import { useState, useTransition } from "react";
import { downloadArtworkOriginalAction } from "./actions";

/**
 * "Descargar original" de un renglón de obra. El servidor decide si corresponde y firma un
 * enlace de 10 minutos; acá sólo se navega a él (FotoRank responde con la descarga).
 */
export function DownloadOriginalButton({ orderId, itemId }: { orderId: string; itemId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pidiendo, startTransition] = useTransition();

  function descargar() {
    setError(null);
    startTransition(async () => {
      const r = await downloadArtworkOriginalAction({ orderId, itemId });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      window.location.assign(r.url);
    });
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" onClick={descargar} disabled={pidiendo} className="fo-btn fo-btn-secondary text-xs">
        {pidiendo ? "Preparando…" : "Descargar original"}
      </button>
      {error ? (
        <span className="text-xs text-[var(--fo-danger)]" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
}
