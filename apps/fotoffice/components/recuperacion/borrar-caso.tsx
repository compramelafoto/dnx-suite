"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { borrarCasoAction } from "@/app/(shell)/recuperacion/actions";
import { RECUPERACION_PANEL_ROUTE } from "@/lib/recuperacion/constantes";

export function BorrarCaso({ id }: { id: string }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function borrar() {
    if (!window.confirm("¿Borrar este caso? Se borran las miniaturas y los datos de FOTOFFICE. Las fotos recuperadas en la computadora del cliente no se tocan.")) return;
    setError(null);
    iniciar(async () => {
      try {
        const r = await borrarCasoAction(id);
        if (!r.ok) return setError(r.error);
        router.push(RECUPERACION_PANEL_ROUTE);
      } catch {
        setError("No se pudo borrar el caso. Probá de nuevo en un rato.");
      }
    });
  }

  return (
    <section className="space-y-2">
      <button type="button" className="fo-btn fo-btn-secondary" disabled={pendiente} onClick={borrar}>
        {pendiente ? "Borrando…" : "Borrar caso"}
      </button>
      {error ? <p role="alert" className="text-sm text-[var(--fo-danger,#b00020)]">{error}</p> : null}
    </section>
  );
}
