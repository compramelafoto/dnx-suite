"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Aviso } from "@/app/_ui/Aviso";
import { Boton } from "@/app/_ui/Boton";

/** Acciones sobre un reporte sin resolver: pasar la publicación a revisión o descartarlo. */
export function AccionesReporte({
  listingId,
  flagId,
  puedeRevisar,
}: {
  listingId: number;
  flagId: number;
  puedeRevisar: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function enviar(accion: "revisar" | "descartar") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/publicaciones/${listingId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accion, flagId }),
      });
      if (res.ok) {
        router.refresh();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "No se pudo guardar la decisión");
    } catch {
      setError("No se pudo conectar. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pila">
      <div className="acciones">
        {puedeRevisar ? (
          <Boton type="button" disabled={busy} onClick={() => enviar("revisar")}>
            Pasar a revisión
          </Boton>
        ) : null}
        <Boton type="button" variante="secundario" disabled={busy} onClick={() => enviar("descartar")}>
          Descartar reporte
        </Boton>
      </div>
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
    </div>
  );
}
