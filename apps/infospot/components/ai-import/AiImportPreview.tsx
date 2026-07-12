"use client";

import type { AiImportMergeMode, PreviewField } from "@/lib/ai-import";
import type { SimilarEventHit } from "@/lib/ai-import/similar-events";
import { AiImportWarningList } from "./AiImportWarnings";

function Badge({ status }: { status: PreviewField["status"] }) {
  const map = {
    detected: {
      label: "Detectado",
      className: "border-emerald-300 bg-emerald-50 text-emerald-900",
    },
    missing: {
      label: "Falta completar",
      className: "border-amber-300 bg-amber-50 text-amber-950",
    },
    review: {
      label: "Requiere revisión",
      className: "border-orange-300 bg-orange-50 text-orange-950",
    },
  } as const;
  const m = map[status];
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${m.className}`}
    >
      {m.label}
    </span>
  );
}

type Props = {
  warnings: string[];
  detected: PreviewField[];
  missing: PreviewField[];
  review: PreviewField[];
  confirmOpen: boolean;
  mergeMode: AiImportMergeMode;
  onMergeModeChange: (mode: AiImportMergeMode) => void;
  similarEvents?: SimilarEventHit[];
  similarLoading?: boolean;
  selectedSimilarKey?: string | null;
  onSelectSimilar?: (key: string | null) => void;
};

export function AiImportPreview({
  warnings,
  detected,
  missing,
  review,
  confirmOpen,
  mergeMode,
  onMergeModeChange,
  similarEvents = [],
  similarLoading = false,
  selectedSimilarKey = null,
  onSelectSimilar,
}: Props) {
  return (
    <div className="space-y-6">
      <h3 className="text-base font-semibold">Revisar importación</h3>
      <AiImportWarningList warnings={warnings} />

      {(
        [
          ["Detectados", detected],
          ["Faltantes", missing],
          ["Revisar", review],
        ] as const
      ).map(([title, items]) =>
        items.length ? (
          <section key={title} className="space-y-3">
            <h4 className="text-sm font-semibold">{title}</h4>
            <ul className="space-y-2">
              {items.map((f) => (
                <li
                  key={`${f.key}-${f.status}`}
                  className="rounded-[var(--is-radius-sm)] border border-[var(--is-border)] px-3 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">{f.label}</p>
                    <Badge status={f.status} />
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--is-muted)]">
                    {f.value || "—"}
                  </p>
                  {f.note ? <p className="mt-1 text-xs text-amber-800">{f.note}</p> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null,
      )}

      {similarLoading ? (
        <p className="text-sm text-[var(--is-muted)]">Buscando eventos similares…</p>
      ) : null}

      {!similarLoading && similarEvents.length > 0 && onSelectSimilar ? (
        <section className="space-y-3">
          <h4 className="text-sm font-semibold">Encontramos eventos similares</h4>
          <p className="text-sm text-[var(--is-muted)]">
            Elegí uno manualmente si corresponde. No se vincula automáticamente.
          </p>
          <ul className="space-y-2">
            {similarEvents.map((ev) => {
              const key = `${ev.source}:${ev.id}`;
              return (
                <li key={key}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-[var(--is-radius-sm)] border border-[var(--is-border)] px-3 py-3 text-sm">
                    <input
                      type="radio"
                      name="similarEvent"
                      checked={selectedSimilarKey === key}
                      onChange={() => onSelectSimilar(key)}
                      className="mt-1"
                    />
                    <span>
                      <span className="font-medium">{ev.title}</span>
                      <span className="mt-1 block text-xs text-[var(--is-muted)]">
                        {ev.source === "CLF" ? "ComprameLaFoto" : "Info Spot"}
                        {ev.city ? ` · ${ev.city}` : ""}
                        {ev.startsAt ? ` · ${ev.startsAt.slice(0, 10)}` : ""}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
            <li>
              <button
                type="button"
                className="text-sm text-[var(--is-accent)] underline"
                onClick={() => onSelectSimilar(null)}
              >
                Ninguno / buscar después
              </button>
            </li>
          </ul>
        </section>
      ) : null}

      {confirmOpen ? (
        <div className="space-y-3 rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] bg-[var(--is-surface)] p-4">
          <p className="text-sm font-semibold">
            Hay campos ya completados. ¿Querés reemplazarlos?
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="mergeMode"
              checked={mergeMode === "empty_only"}
              onChange={() => onMergeModeChange("empty_only")}
            />
            Completar solo campos vacíos (recomendado)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="mergeMode"
              checked={mergeMode === "replace_all"}
              onChange={() => onMergeModeChange("replace_all")}
            />
            Reemplazar todos
          </label>
        </div>
      ) : null}
    </div>
  );
}
