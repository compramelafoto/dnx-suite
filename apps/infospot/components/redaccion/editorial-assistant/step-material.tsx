"use client";

import { useMemo } from "react";
import type { AssistantCoverageCard } from "@/lib/editorial-assistant";
import {
  commercialStatusLabel,
  formatEventDate,
  materialSummary,
} from "@/lib/editorial-assistant";

type Props = {
  coverages: AssistantCoverageCard[];
  selectedIds: string[];
  eventId: number | null;
  onToggle: (coverage: AssistantCoverageCard) => void;
  onBack: () => void;
  onContinue: () => void;
  allowSkip?: boolean;
  onSkip?: () => void;
};

export function StepMaterial({
  coverages,
  selectedIds,
  eventId,
  onToggle,
  onBack,
  onContinue,
  allowSkip,
  onSkip,
}: Props) {
  const visible = useMemo(() => {
    if (eventId == null) return coverages;
    return coverages.filter((c) => c.clfEventId === eventId);
  }, [coverages, eventId]);

  const selected = useMemo(
    () => visible.filter((c) => selectedIds.includes(c.id)),
    [visible, selectedIds],
  );
  const summary = materialSummary(selected);

  // Agrupar visualmente: coberturas → fotógrafos derivados del resumen
  const photographers = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of selected) {
      for (const name of c.photographerNames) {
        map.set(name, (map.get(name) ?? 0) + 1);
      }
    }
    return Array.from(map.entries());
  }, [selected]);

  return (
    <div className="space-y-8">
      <header className="max-w-2xl">
        <h1 className="font-[family-name:var(--font-source-serif)] text-[clamp(1.75rem,1.3rem+1.5vw,2.5rem)] font-semibold leading-tight tracking-tight">
          Material Editorial
        </h1>
        <p className="mt-4 text-base leading-relaxed text-[var(--is-muted)]">
          Elegí las coberturas fotográficas. Después seleccionamos las fotos.
        </p>
      </header>

      <section
        aria-labelledby="mat-coberturas"
        className="space-y-4"
      >
        <h2
          id="mat-coberturas"
          className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--is-accent)]"
        >
          Coberturas fotográficas
        </h2>
        {visible.length === 0 ? (
          <p className="rounded-[var(--is-radius-md)] border border-dashed border-[var(--is-border)] bg-white p-8 text-center text-[var(--is-muted)]">
            Todavía no hay material editorial para este evento.
          </p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2" role="list">
            {visible.map((c) => {
              const checked = selectedIds.includes(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onToggle(c)}
                    aria-pressed={checked}
                    className={`flex w-full gap-4 rounded-[var(--is-radius-md)] border p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--is-accent)] ${
                      checked
                        ? "border-[var(--is-accent)] bg-[var(--is-accent)]/5"
                        : "border-[var(--is-border)] bg-white hover:border-[var(--is-accent)]"
                    }`}
                  >
                    <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-[var(--is-radius-sm)] bg-[var(--is-bg-muted)] text-center text-[10px] leading-tight text-[var(--is-muted)]">
                      {c.coverThumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.coverThumbnailUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="px-1">Sin vista previa</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-semibold leading-snug">{c.title}</p>
                      <p className="text-sm text-[var(--is-muted)]">
                        {c.photographerNames[0] || "Fotógrafo a confirmar"}
                        {c.photographerNames.length > 1
                          ? ` +${c.photographerNames.length - 1}`
                          : ""}
                      </p>
                      <p className="text-xs text-[var(--is-muted)]">
                        {c.photoCount} fotos · {commercialStatusLabel(c.commercialStatus)}
                        {c.lastSyncedAt
                          ? ` · ${formatEventDate(c.lastSyncedAt)}`
                          : ""}
                      </p>
                    </div>
                    <span
                      className={`mt-1 inline-flex size-5 shrink-0 items-center justify-center rounded border ${
                        checked
                          ? "border-[var(--is-accent)] bg-[var(--is-accent)] text-white"
                          : "border-[var(--is-border)]"
                      }`}
                      aria-hidden
                    >
                      {checked ? "✓" : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="flex flex-col items-center gap-2 text-[var(--is-muted)]" aria-hidden>
        <span>↓</span>
      </div>

      <section aria-labelledby="mat-fotografos" className="space-y-3">
        <h2
          id="mat-fotografos"
          className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--is-accent)]"
        >
          Fotógrafos
        </h2>
        {photographers.length === 0 ? (
          <p className="text-sm text-[var(--is-muted)]">Seleccioná coberturas para ver fotógrafos.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {photographers.map(([name]) => (
              <li
                key={name}
                className="rounded-full border border-[var(--is-border)] bg-white px-3 py-1.5 text-sm"
              >
                {name}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-col items-center gap-2 text-[var(--is-muted)]" aria-hidden>
        <span>↓</span>
      </div>

      <section aria-labelledby="mat-fotos" className="space-y-3">
        <h2
          id="mat-fotos"
          className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--is-accent)]"
        >
          Fotografías
        </h2>
        <p
          className="rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-white px-5 py-4 text-base"
          aria-live="polite"
        >
          <strong className="tabular-nums">{summary.coverageCount}</strong> coberturas
          {" · "}
          <strong className="tabular-nums">{summary.photographerCount}</strong> fotógrafos
          {" · "}
          <strong className="tabular-nums">{summary.photoCount}</strong> fotografías
          disponibles
        </p>
      </section>

      <div className="flex flex-col-reverse gap-3 border-t border-[var(--is-border)] pt-8 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-11 items-center justify-center rounded-[var(--is-radius-sm)] border border-[var(--is-border)] px-4 text-sm font-medium"
        >
          Atrás
        </button>
        <div className="flex flex-col gap-3 sm:flex-row">
          {allowSkip && onSkip ? (
            <button
              type="button"
              onClick={onSkip}
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--is-radius-sm)] border border-[var(--is-border)] px-4 text-sm font-medium"
            >
              Seguir sin material
            </button>
          ) : null}
          <button
            type="button"
            disabled={selectedIds.length === 0}
            onClick={onContinue}
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-5 text-sm font-semibold text-white disabled:opacity-40"
          >
            Elegir fotografías
          </button>
        </div>
      </div>
    </div>
  );
}
