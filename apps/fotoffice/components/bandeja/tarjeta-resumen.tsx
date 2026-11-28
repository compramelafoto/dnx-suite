"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { actualizarResumenAction } from "@/app/actions/bandeja";

/** Resumen de la charla arriba de la conversación, plegable, con «Actualizar» (sólo quien puede operar). */
export function TarjetaResumen({ chatId, resumen, haceTexto, puedeActualizar }: { chatId: string; resumen: string | null; haceTexto: string | null; puedeActualizar: boolean }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!resumen && !puedeActualizar) return null;
  const actualizar = () => {
    setError(null);
    iniciar(async () => {
      const r = await actualizarResumenAction(chatId).catch(() => ({ ok: false as const, error: "No se pudo armar el resumen ahora." }));
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  };
  return (
    <details open={Boolean(resumen)} className="rounded-[var(--fo-radius)] border border-[var(--fo-accent-muted)] bg-[var(--fo-accent-soft)] px-3 py-2 text-sm">
      <summary className="cursor-pointer font-medium text-[var(--fo-accent-hover)]">
        Resumen{haceTexto ? ` (${haceTexto})` : ""}
      </summary>
      {resumen ? <p className="mt-1 whitespace-pre-wrap text-[var(--fo-text)]">{resumen}</p> : <p className="mt-1 text-[var(--fo-muted)]">Todavía no hay resumen de esta charla.</p>}
      {puedeActualizar ? (
        <button type="button" className="mt-1 text-xs text-[var(--fo-accent-hover)] underline" disabled={pendiente} onClick={actualizar}>
          {pendiente ? "Armando…" : resumen ? "Actualizar" : "Armar resumen"}
        </button>
      ) : null}
      {error ? <p role="alert" className="text-xs text-[var(--fo-danger)]">{error}</p> : null}
    </details>
  );
}
