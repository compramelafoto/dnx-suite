"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Props = { contestId: string; initiallyAccepted: boolean };

/**
 * Gate de términos de jurado (staging).
 * BORRADOR — LEGAL REVIEW REQUIRED — NO PUBLICAR
 */
export function JuryTermsGate({ contestId, initiallyAccepted }: Props) {
  const router = useRouter();
  const [accepted, setAccepted] = useState(initiallyAccepted);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (accepted) {
    return (
      <p className="text-sm text-emerald-300" data-testid="jury-terms-accepted">
        Términos de jurado aceptados (versión staging).
      </p>
    );
  }

  return (
    <section
      className="fr-recuadro space-y-6 border border-amber-500/40 bg-amber-500/10"
      data-testid="jury-terms-gate"
    >
      <h2 className="text-lg font-semibold text-fr-primary">Términos de jurado (borrador)</h2>
      <p className="text-sm text-fr-muted leading-relaxed">
        BORRADOR — LEGAL REVIEW REQUIRED — NO PUBLICAR. Al continuar declarás confidencialidad,
        imparcialidad, obligación de declarar conflictos, prohibición de compartir obras o
        capturas no autorizadas, respeto del anonimato y aceptación de la rúbrica y auditoría.
      </p>
      <label className="flex items-start gap-4 text-sm text-fr-muted">
        <input
          type="checkbox"
          className="mt-1 size-5 accent-[#d4af37]"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          data-testid="jury-terms-check"
        />
        <span>Acepto los términos de jurado de staging (no constituye aceptación legal definitiva).</span>
      </label>
      <button
        type="button"
        className="fr-btn fr-btn-primary min-h-11 px-5"
        disabled={!checked || pending}
        data-testid="jury-terms-submit"
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await fetch(`/api/fotorank/jury/contests/${contestId}/terms`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ locale: "es-AR" }),
            });
            const json = (await res.json()) as { ok?: boolean; error?: { message?: string } };
            if (!res.ok || !json.ok) {
              setError(json.error?.message ?? "No se pudo registrar la aceptación.");
              return;
            }
            setAccepted(true);
            router.refresh();
          })
        }
      >
        Aceptar términos
      </button>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </section>
  );
}
