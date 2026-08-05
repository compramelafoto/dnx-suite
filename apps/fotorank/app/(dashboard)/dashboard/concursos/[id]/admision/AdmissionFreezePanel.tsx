"use client";

import { useState, useTransition } from "react";

type Props = { contestId: string };

const CATEGORIES = [
  { slug: "fotografo-amateur", label: "Amateur" },
  { slug: "fotografo-profesional", label: "Profesional" },
  { slug: "reportero-grafico", label: "Reportero" },
  { slug: "fotografia-aerea", label: "Aérea" },
] as const;

type DryRunResult = {
  ok?: boolean;
  error?: { message?: string; code?: string };
  wouldFreeze?: number;
  frozen?: number;
  selectionHash?: string;
  expectedCount?: number;
  categorySlugs?: string[];
  entryIds?: string[];
  confirmHint?: string;
  counts?: {
    admittedSelected?: number;
    pendingReview?: number;
    rejected?: number;
    alreadyFrozen?: number;
    omittedFromSelection?: number;
  };
  byCategory?: Record<string, number>;
  samplePayloads?: Array<{ leaks: string[]; anonymousCode?: string }>;
  entryCodes?: string[];
  batchId?: string;
};

export function AdmissionFreezePanel({ contestId }: Props) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>(["fotografo-amateur"]);
  const [dry, setDry] = useState<DryRunResult | null>(null);
  const [confirmPhrase, setConfirmPhrase] = useState("");

  function toggle(slug: string) {
    setSelected((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
    setDry(null);
  }

  async function run(dryRun: boolean) {
    setError(null);
    setResult(null);
    if (selected.length === 0) {
      setError("Seleccioná al menos una categoría (alcance explícito obligatorio).");
      return;
    }
    startTransition(async () => {
      const body: Record<string, unknown> = {
        dryRun,
        categorySlugs: selected,
        requestId: `freeze-${Date.now()}`,
      };
      if (!dryRun && dry) {
        body.selectionHash = dry.selectionHash;
        body.expectedCount = dry.expectedCount;
        body.entryIds = dry.entryIds;
        body.batchId = dry.batchId;
        body.confirmPhrase = confirmPhrase.trim() || dry.confirmHint;
      }
      const res = await fetch(`/api/fotorank/contests/${contestId}/admission/freeze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as DryRunResult;
      if (!res.ok || !data.ok) {
        setError(data.error?.message ?? "Error en freeze.");
        return;
      }
      if (dryRun) {
        setDry(data);
        const leaks = (data.samplePayloads ?? []).flatMap((p) => p.leaks);
        setResult(
          [
            `Dry-run selectivo: ${data.wouldFreeze ?? 0} obras.`,
            `Hash: ${data.selectionHash ?? "—"}`,
            `Pendientes revisión (concurso): ${data.counts?.pendingReview ?? 0}`,
            `Rechazadas: ${data.counts?.rejected ?? 0}`,
            `Ya congeladas: ${data.counts?.alreadyFrozen ?? 0}`,
            `Omitidas por exclusión: ${data.counts?.omittedFromSelection ?? 0}`,
            `Por categoría: ${JSON.stringify(data.byCategory ?? {})}`,
            `Códigos muestra: ${(data.entryCodes ?? []).slice(0, 8).join(", ") || "—"}`,
            `Leaks: ${leaks.length ? leaks.join(", ") : "ninguno"}`,
            data.confirmHint ? `Confirmación apply: ${data.confirmHint}` : "",
          ]
            .filter(Boolean)
            .join(" · "),
        );
      } else {
        setResult(`Freeze aplicado: ${data.frozen ?? 0} obras → FROZEN_FOR_JURY (hash verificado).`);
        setDry(null);
        setConfirmPhrase("");
      }
    });
  }

  return (
    <section className="fr-recuadro border border-fr-border bg-fr-card space-y-6" data-testid="admission-freeze">
      <h2 className="text-lg font-semibold">Freeze selectivo previo al jurado</h2>
      <p className="text-sm text-fr-muted">
        No congela todas las ADMITTED del concurso. Debés elegir categorías (o IDs vía API). Dry-run
        genera selection hash; el apply aborta si el conjunto cambió.
      </p>

      <div className="space-y-3" data-testid="freeze-category-select">
        <p className="text-sm font-semibold">Categorías a congelar</p>
        <div className="flex flex-wrap gap-3">
          {CATEGORIES.map((c) => {
            const on = selected.includes(c.slug);
            return (
              <button
                key={c.slug}
                type="button"
                data-testid={`freeze-cat-${c.slug}`}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  on ? "border-gold bg-gold/10 text-gold" : "border-fr-border text-fr-muted"
                }`}
                onClick={() => toggle(c.slug)}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {dry?.confirmHint ? (
        <label className="block space-y-3">
          <span className="text-sm font-semibold">
            Confirmación apply (escribí exactamente: {dry.confirmHint})
          </span>
          <input
            className="fr-filter-input w-full"
            data-testid="freeze-confirm-phrase"
            value={confirmPhrase}
            onChange={(e) => setConfirmPhrase(e.target.value)}
            placeholder={dry.confirmHint}
          />
        </label>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="fr-btn fr-btn-secondary px-5 py-3"
          disabled={pending}
          data-testid="freeze-dry-run"
          onClick={() => run(true)}
        >
          Dry-run selectivo
        </button>
        <button
          type="button"
          className="fr-btn fr-btn-primary px-5 py-3"
          disabled={pending || !dry?.selectionHash}
          data-testid="freeze-apply"
          onClick={() => {
            const n = dry?.expectedCount ?? 0;
            const msg = `Se congelarán ${n} obras admitidas para el jurado. Las obras congeladas ya no podrán reemplazarse ni cambiar de categoría.`;
            if (confirm(msg)) run(false);
          }}
        >
          Aplicar freeze (con hash)
        </button>
      </div>
      {error ? (
        <p className="text-sm text-red-300" data-testid="freeze-error">
          {error}
        </p>
      ) : null}
      {result ? (
        <p className="text-sm text-fr-primary" data-testid="freeze-result">
          {result}
        </p>
      ) : null}
    </section>
  );
}
