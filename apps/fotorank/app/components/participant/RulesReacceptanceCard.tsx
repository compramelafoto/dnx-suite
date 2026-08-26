"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  contestId: string;
  currentRulesVersionId: string;
  currentRulesContent: string;
  currentRulesTitle: string | null;
};

export function RulesReacceptanceCard({
  contestId,
  currentRulesVersionId,
  currentRulesContent,
  currentRulesTitle,
}: Props) {
  const router = useRouter();
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [licenseAccepted, setLicenseAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/fotorank/contests/${contestId}/registrations/reaccept-rules`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              rulesVersionId: currentRulesVersionId,
              rulesAccepted,
              licenseAccepted,
            }),
          },
        );
        const json = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        if (!res.ok) {
          setError(json?.error?.message ?? "No se pudo registrar la aceptación.");
          return;
        }
        router.refresh();
      } catch {
        setError("Error de red. Intentá de nuevo.");
      }
    });
  }

  return (
    <section
      className="fr-recuadro border border-amber-500/40 bg-amber-500/10"
      data-testid="rules-reacceptance-card"
      aria-labelledby="rules-reaccept-heading"
    >
      <h2 id="rules-reaccept-heading" className="text-xl font-semibold tracking-tight text-fr-primary">
        Nuevas Bases y Condiciones
      </h2>
      <p className="mt-4 text-sm leading-relaxed text-fr-muted md:text-base">
        Se publicó una versión actualizada
        {currentRulesTitle ? ` (${currentRulesTitle})` : ""}. Debés leerla y aceptarla
        expresamente antes de cargar o confirmar tu fotografía. No se registra aceptación
        automática.
      </p>

      <div className="mt-8 max-h-80 overflow-y-auto whitespace-pre-wrap rounded-xl border border-fr-border bg-fr-bg/60 p-6 text-sm leading-relaxed text-fr-muted">
        {currentRulesContent}
      </div>

      <div className="fr-field-stack mt-10 space-y-8">
        <label className="flex items-start gap-3 text-sm text-fr-primary">
          <input
            type="checkbox"
            className="mt-1 size-4 accent-[#d4af37]"
            checked={rulesAccepted}
            onChange={(e) => setRulesAccepted(e.target.checked)}
            disabled={pending}
          />
          <span>Leí y acepto las Bases y Condiciones vigentes.</span>
        </label>
        <label className="flex items-start gap-3 text-sm text-fr-primary">
          <input
            type="checkbox"
            className="mt-1 size-4 accent-[#d4af37]"
            checked={licenseAccepted}
            onChange={(e) => setLicenseAccepted(e.target.checked)}
            disabled={pending}
          />
          <span>Acepto la licencia de uso descripta en las Bases vigentes.</span>
        </label>
      </div>

      {error ? <p className="fr-form-error-text mt-6">{error}</p> : null}

      <div className="fr-content-to-actions mt-16 border-t border-fr-border pt-8">
        <button
          type="button"
          className="fr-btn fr-btn-primary"
          disabled={pending || !rulesAccepted || !licenseAccepted}
          onClick={onSubmit}
        >
          {pending ? "Registrando…" : "Aceptar versión vigente"}
        </button>
      </div>
    </section>
  );
}
