"use client";

import type { AssistantDraftFields, StoryType } from "@/lib/editorial-assistant";
import { STORY_TYPE_OPTIONS } from "@/lib/editorial-assistant";

type Autofill = {
  eventTitle?: string | null;
  city?: string | null;
  photographers?: string[];
  coverages?: string[];
  materialSummary?: string;
};

type Props = {
  draft: AssistantDraftFields;
  autofill: Autofill;
  onChange: (patch: Partial<AssistantDraftFields>) => void;
  onBack: () => void;
  onContinue: () => void;
};

export function StepDraft({ draft, autofill, onChange, onBack, onContinue }: Props) {
  const canContinue = draft.title.trim().length > 0 && draft.storyType != null;

  return (
    <div className="space-y-8">
      <header className="max-w-2xl">
        <h1 className="font-[family-name:var(--font-source-serif)] text-[clamp(1.75rem,1.3rem+1.5vw,2.5rem)] font-semibold leading-tight tracking-tight">
          Preparar borrador
        </h1>
        <p className="mt-4 text-base leading-relaxed text-[var(--is-muted)]">
          Ya armamos el contexto. Solo necesitamos lo esencial para abrir el editor.
        </p>
      </header>

      <section
        aria-labelledby="autofill-heading"
        className="rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-[var(--is-bg-muted)]/40 p-5 sm:p-6"
      >
        <h2
          id="autofill-heading"
          className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--is-accent)]"
        >
          Completado automáticamente
        </h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--is-muted)]">Evento</dt>
            <dd className="font-medium">{autofill.eventTitle || "Sin evento"}</dd>
          </div>
          <div>
            <dt className="text-[var(--is-muted)]">Ciudad</dt>
            <dd className="font-medium">{autofill.city || "A confirmar"}</dd>
          </div>
          <div>
            <dt className="text-[var(--is-muted)]">Fotógrafos</dt>
            <dd className="font-medium">
              {autofill.photographers?.length
                ? autofill.photographers.join(", ")
                : "Sin fotógrafos aún"}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--is-muted)]">Coberturas</dt>
            <dd className="font-medium">
              {autofill.coverages?.length
                ? autofill.coverages.join(", ")
                : "Sin coberturas"}
            </dd>
          </div>
          {autofill.materialSummary ? (
            <div className="sm:col-span-2">
              <dt className="text-[var(--is-muted)]">Material</dt>
              <dd className="font-medium">{autofill.materialSummary}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <div className="space-y-8 max-w-xl">
        <label className="block">
          <span className="mb-2 block text-base font-semibold">Título</span>
          <input
            type="text"
            value={draft.title}
            onChange={(e) => onChange({ title: e.target.value })}
            required
            className="min-h-12 w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border)] px-4 text-base"
            placeholder="El titular de la historia"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-base font-semibold">Bajada</span>
          <textarea
            value={draft.excerpt}
            onChange={(e) => onChange({ excerpt: e.target.value })}
            rows={3}
            className="w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border)] px-4 py-3 text-base leading-relaxed"
            placeholder="Una o dos oraciones que anticipen la nota"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-base font-semibold">Autor</span>
          <input
            type="text"
            value={draft.authorByline}
            onChange={(e) => onChange({ authorByline: e.target.value })}
            className="min-h-12 w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border)] px-4 text-base"
            placeholder="Firma o por línea"
          />
        </label>

        <fieldset>
          <legend className="mb-3 text-base font-semibold">Tipo de historia</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {STORY_TYPE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer flex-col gap-1 rounded-[var(--is-radius-sm)] border px-4 py-3 ${
                  draft.storyType === opt.value
                    ? "border-[var(--is-accent)] bg-[var(--is-accent)]/5"
                    : "border-[var(--is-border)] bg-white"
                }`}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="storyType"
                    value={opt.value}
                    checked={draft.storyType === opt.value}
                    onChange={() => onChange({ storyType: opt.value as StoryType })}
                    className="accent-[var(--is-accent)]"
                  />
                  <span className="font-semibold">{opt.label}</span>
                </span>
                <span className="pl-6 text-xs text-[var(--is-muted)]">{opt.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-[var(--is-border)] pt-8 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-11 items-center justify-center rounded-[var(--is-radius-sm)] border border-[var(--is-border)] px-4 text-sm font-medium"
        >
          Atrás
        </button>
        <button
          type="button"
          disabled={!canContinue}
          onClick={onContinue}
          className="inline-flex min-h-11 items-center justify-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-5 text-sm font-semibold text-white disabled:opacity-40"
        >
          Ver resumen
        </button>
      </div>
    </div>
  );
}
