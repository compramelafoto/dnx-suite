"use client";

import {
  materialSummary,
  photoSelectionSummary,
  storyTypeLabel,
  type EditorialAssistantState,
} from "@/lib/editorial-assistant";

type Props = {
  state: EditorialAssistantState;
  pending: boolean;
  error: string | null;
  onBack: () => void;
  onOpenEditor: () => void;
  onSaveForLater: () => void;
};

export function StepSummary({
  state,
  pending,
  error,
  onBack,
  onOpenEditor,
  onSaveForLater,
}: Props) {
  const material = materialSummary(
    state.coverages.map((c) => ({
      ...c,
      photographerNames: c.photographerNames,
    })),
  );
  const photos = photoSelectionSummary(state.photos);

  return (
    <div className="space-y-8">
      <header className="max-w-2xl text-center sm:text-left">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--is-accent)]">
          Asistente editorial
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-source-serif)] text-[clamp(1.85rem,1.4rem+1.6vw,2.75rem)] font-semibold leading-tight tracking-tight">
          Tu historia está lista
        </h1>
        <p className="mt-4 text-base leading-relaxed text-[var(--is-muted)]">
          Preparamos el contexto. Ahora solo queda escribir.
        </p>
      </header>

      <div className="mx-auto max-w-xl divide-y divide-[var(--is-border)] rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-white">
        <section className="space-y-2 px-6 py-5">
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--is-muted)]">
            Evento
          </h2>
          <p className="font-[family-name:var(--font-source-serif)] text-xl font-semibold">
            {state.event?.title || "Sin evento vinculado"}
          </p>
        </section>

        <section className="space-y-2 px-6 py-5">
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--is-muted)]">
            Material editorial
          </h2>
          <ul className="space-y-1 text-sm">
            <li>✓ {material.coverageCount} coberturas</li>
            <li>✓ {material.photographerCount} fotógrafos</li>
            <li>✓ {material.photoCount} fotografías</li>
          </ul>
        </section>

        <section className="space-y-2 px-6 py-5">
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--is-muted)]">
            Seleccionaste
          </h2>
          <ul className="space-y-1 text-sm">
            <li>✓ {photos.cover} portada</li>
            <li>✓ {photos.gallery} fotos para galería</li>
            <li>✓ {photos.inline} fotos para insertar</li>
          </ul>
        </section>

        <section className="space-y-2 px-6 py-5">
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--is-muted)]">
            Título
          </h2>
          <p className="font-[family-name:var(--font-source-serif)] text-lg font-semibold leading-snug">
            {state.draft.title || "Sin título"}
          </p>
          {state.draft.excerpt ? (
            <p className="text-sm leading-relaxed text-[var(--is-muted)]">
              {state.draft.excerpt}
            </p>
          ) : null}
          <p className="text-xs text-[var(--is-muted)]">
            {storyTypeLabel(state.draft.storyType)}
            {state.draft.authorByline ? ` · ${state.draft.authorByline}` : ""}
          </p>
        </section>
      </div>

      {error ? (
        <p className="rounded-[var(--is-radius-sm)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <button
          type="button"
          disabled={pending}
          onClick={onOpenEditor}
          className="inline-flex min-h-12 items-center justify-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-6 text-base font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Preparando…" : "Abrir editor"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onSaveForLater}
          className="inline-flex min-h-12 items-center justify-center rounded-[var(--is-radius-sm)] border border-[var(--is-border)] px-6 text-base font-medium"
        >
          Guardar para continuar después
        </button>
      </div>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-[var(--is-muted)] underline-offset-2 hover:underline"
        >
          Volver a editar el borrador
        </button>
      </div>
    </div>
  );
}
