"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { TextoDeTerminos } from "../../../../lib/fotorank/jury/terminosDelJurado";

type Props = {
  contestId: string;
  initiallyAccepted: boolean;
  texto: TextoDeTerminos;
};

/**
 * Lo que el jurado acepta antes de ver la primera obra.
 *
 * El texto viene de afuera porque no es el mismo para todos los concursos: a
 * una jurado real de Clickatón le aparecía el borrador de Santa Fe, con sus
 * marcas de "NO PUBLICAR" y "no constituye aceptación legal definitiva". Un
 * texto que se declara no válido no sirve para pedir un compromiso.
 */
export function JuryTermsGate({ contestId, initiallyAccepted, texto }: Props) {
  const router = useRouter();
  const [accepted, setAccepted] = useState(initiallyAccepted);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (accepted) return null;

  return (
    <section
      className="fr-recuadro space-y-6 border border-amber-500/40 bg-amber-500/10"
      data-testid="jury-terms-gate"
    >
      <h2 className="text-lg font-semibold text-fr-primary">{texto.titulo}</h2>
      <p className="max-w-2xl text-sm leading-relaxed text-fr-muted">{texto.cuerpo}</p>

      {texto.advertencia ? (
        <p className="text-xs uppercase tracking-wide text-amber-300">{texto.advertencia}</p>
      ) : null}

      <label className="flex items-start gap-4 text-sm text-fr-muted">
        <input
          type="checkbox"
          className="mt-1 size-5 accent-[#d4af37]"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          data-testid="jury-terms-check"
        />
        <span>{texto.casilla}</span>
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
        {pending ? "Un momento…" : texto.boton}
      </button>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </section>
  );
}
