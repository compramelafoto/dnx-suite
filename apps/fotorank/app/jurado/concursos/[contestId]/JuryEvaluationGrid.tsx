"use client";

import { useMemo, useState } from "react";

export type JuryGridStatus = "NOT_STARTED" | "IN_PROGRESS" | "POSTPONED" | "COMPLETED" | "CONFLICT_DECLARED";

export type JuryGridEntry = {
  snapshotId: string;
  anonymousCode: string;
  previewUrl: string | null;
  categoryName: string;
  /** Puntajes propios del jurado logueado (ETAPA 16A no muestra scores de otros jurados). */
  scores: number[];
  average: number | null;
  status: JuryGridStatus;
};

type SortMode = "original" | "random" | "highest" | "lowest" | "pending" | "postponed";

const SORT_LABELS: Record<SortMode, string> = {
  original: "Orden original",
  random: "Aleatorio",
  highest: "Mayor puntaje",
  lowest: "Menor puntaje",
  pending: "Pendientes primero",
  postponed: "Pospuestas primero",
};

const STATUS_LABELS: Record<JuryGridStatus, string> = {
  NOT_STARTED: "Sin empezar",
  IN_PROGRESS: "En progreso",
  POSTPONED: "Pospuesta",
  COMPLETED: "Completada",
  CONFLICT_DECLARED: "Conflicto declarado",
};

const STATUS_BADGE_CLASS: Record<JuryGridStatus, string> = {
  NOT_STARTED: "border-fr-border text-fr-muted",
  IN_PROGRESS: "border-amber-500/40 text-amber-200",
  POSTPONED: "border-sky-500/40 text-sky-200",
  COMPLETED: "border-emerald-500/40 text-emerald-300",
  CONFLICT_DECLARED: "border-red-500/40 text-red-300",
};

/** Hash estable simple (no criptográfico) para el orden "aleatorio" — no depende de Date.now(). */
function seededOrderKey(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  return h;
}

type Props = {
  entries: JuryGridEntry[];
  onOpen: (snapshotId: string) => void;
  /** Semilla estable para el orden aleatorio (p. ej. judgeAccountId+contestId). No usar Math.random(). */
  randomSeed?: string;
};

/**
 * Grilla de obras para el jurado (ETAPA 16A).
 * Muestra únicamente los scores propios del jurado logueado (no promedios de otros jurados,
 * consistente con la regla de anonimato de Etapa 07/13).
 */
export function JuryEvaluationGrid({ entries, onOpen, randomSeed = "" }: Props) {
  const [sortMode, setSortMode] = useState<SortMode>("original");

  const sorted = useMemo(() => {
    const list = [...entries];
    switch (sortMode) {
      case "highest":
        return list.sort((a, b) => (b.average ?? -1) - (a.average ?? -1));
      case "lowest":
        return list.sort((a, b) => (a.average ?? -1) - (b.average ?? -1));
      case "pending":
        return list.sort((a, b) => {
          const rank = (s: JuryGridStatus) => (s === "NOT_STARTED" ? 0 : s === "IN_PROGRESS" ? 1 : 2);
          return rank(a.status) - rank(b.status);
        });
      case "postponed":
        return list.sort((a, b) => {
          const rank = (s: JuryGridStatus) => (s === "POSTPONED" ? 0 : 1);
          return rank(a.status) - rank(b.status);
        });
      case "random":
        return list.sort(
          (a, b) =>
            seededOrderKey(`${randomSeed}|${a.snapshotId}`) -
            seededOrderKey(`${randomSeed}|${b.snapshotId}`),
        );
      default:
        return list;
    }
  }, [entries, sortMode, randomSeed]);

  const incompleteCount = entries.filter(
    (e) => e.status === "NOT_STARTED" || e.status === "IN_PROGRESS" || e.status === "POSTPONED",
  ).length;

  return (
    <div className="space-y-6" data-testid="jury-evaluation-grid">
      {incompleteCount > 0 ? (
        <div
          className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-4 text-sm text-amber-100"
          data-testid="jury-grid-incomplete-banner"
        >
          Tenés {incompleteCount} obra{incompleteCount === 1 ? "" : "s"} sin completar (sin empezar,
          en progreso o pospuestas).
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-semibold text-fr-primary" htmlFor="jury-grid-sort">
          Ordenar
        </label>
        <select
          id="jury-grid-sort"
          className="fr-filter-select"
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as SortMode)}
          data-testid="jury-grid-sort"
        >
          {Object.entries(SORT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((entry) => (
          <li
            key={entry.snapshotId}
            className="fr-recuadro space-y-4 border border-fr-border bg-fr-card"
            data-testid={`jury-grid-card-${entry.snapshotId}`}
          >
            <button
              type="button"
              onClick={() => onOpen(entry.snapshotId)}
              className="block w-full text-left"
              data-testid={`jury-grid-open-${entry.snapshotId}`}
            >
              {entry.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={entry.previewUrl}
                  alt={`Vista anónima ${entry.anonymousCode}`}
                  className="max-h-48 w-full rounded-xl object-contain bg-black"
                />
              ) : (
                <div className="flex h-48 w-full items-center justify-center rounded-xl border border-dashed border-fr-border text-xs text-fr-muted">
                  Sin preview
                </div>
              )}
              <p className="mt-4 text-base font-semibold text-gold">{entry.anonymousCode}</p>
              <p className="mt-1 text-xs text-fr-muted">{entry.categoryName}</p>
            </button>

            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-fr-muted">
              <span>
                Tus puntajes: {entry.scores.length ? entry.scores.join(" · ") : "—"}
              </span>
              <span className="font-semibold text-fr-primary">
                Promedio: {entry.average != null ? entry.average.toFixed(1) : "—"}
              </span>
            </div>

            <span
              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_BADGE_CLASS[entry.status]}`}
            >
              {STATUS_LABELS[entry.status]}
            </span>
          </li>
        ))}
        {sorted.length === 0 ? (
          <li className="text-sm text-fr-muted">No hay obras disponibles.</li>
        ) : null}
      </ul>
    </div>
  );
}
