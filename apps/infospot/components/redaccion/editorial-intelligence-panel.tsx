"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  createEditorialAssistantEngine,
  type EditorialAssistantResult,
  type EditorialRelatedHit,
  type EditorialSuggestion,
} from "@repo/editorial-intelligence";
import { fetchEditorialAssistantContextAction } from "@/app/actions/editorial-intelligence";
import {
  buildInfoSpotDraftSnapshot,
  type InfoSpotAssistantFormState,
} from "@/lib/editorial-intelligence/snapshot";
import {
  focusEditorialTarget,
  resolveChecklistFocusTarget,
  resolveSuggestionFocusTarget,
  type EditorialFocusTarget,
} from "@/lib/editorial-intelligence/focus-targets";

const engine = createEditorialAssistantEngine();

type Props = {
  form: InfoSpotAssistantFormState;
  articleId?: string | null;
  onApplyCategory?: (categoryId: string) => void;
  onApplyTags?: (tags: string[]) => void;
  /** Navega al campo del formulario (abre Configuración si hace falta). */
  onNavigateToField?: (target: EditorialFocusTarget) => void;
};

function severityClass(severity: EditorialSuggestion["severity"]): string {
  switch (severity) {
    case "success":
      return "border-emerald-300 bg-emerald-50 text-emerald-950";
    case "warning":
      return "border-amber-300 bg-amber-50 text-amber-950";
    case "danger":
      return "border-red-300 bg-red-50 text-red-950";
    default:
      return "border-[var(--is-border)] bg-[var(--is-surface)] text-[var(--is-fg)]";
  }
}

function RelatedList({ items }: { items: EditorialRelatedHit[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1.5">
      {items.map((item) => (
        <li key={`${item.kind}:${item.id}`}>
          <Link
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-[var(--is-accent)] underline-offset-2 hover:underline"
          >
            {item.title}
          </Link>
          <span className="ml-2 text-[11px] uppercase tracking-wide text-[var(--is-muted)]">
            {item.kind}
          </span>
        </li>
      ))}
    </ul>
  );
}

function SuggestionNavItem({
  suggestion,
  onNavigate,
}: {
  suggestion: EditorialSuggestion;
  onNavigate: (target: EditorialFocusTarget) => void;
}) {
  const target =
    suggestion.severity === "success"
      ? null
      : resolveSuggestionFocusTarget(suggestion.id);
  const className = `rounded-lg border px-3 py-2 text-sm ${severityClass(suggestion.severity)}`;

  if (!target) {
    return <p className={className}>{suggestion.message}</p>;
  }

  return (
    <button
      type="button"
      onClick={() => onNavigate(target)}
      className={`${className} flex w-full items-start justify-between gap-3 text-left transition hover:brightness-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--is-accent)]`}
    >
      <span>{suggestion.message}</span>
      <span className="shrink-0 text-xs font-semibold opacity-80">Ir →</span>
    </button>
  );
}

/**
 * Panel lateral no invasivo — Asistente Editorial (reglas, sin LLM).
 * No modifica el documento salvo acciones explícitas del editor.
 */
export function EditorialIntelligencePanel({
  form,
  articleId,
  onApplyCategory,
  onApplyTags,
  onNavigateToField,
}: Props) {
  const [relatedHits, setRelatedHits] = useState<EditorialRelatedHit[]>([]);
  const [duplicateHits, setDuplicateHits] = useState<EditorialRelatedHit[]>([]);
  const [linkHits, setLinkHits] = useState<EditorialRelatedHit[]>([]);
  const [pending, startTransition] = useTransition();
  const [selectedTags, setSelectedTags] = useState<string[]>(form.selectedTags ?? []);

  function goTo(target: EditorialFocusTarget | null) {
    if (!target) return;
    if (onNavigateToField) {
      onNavigateToField(target);
      return;
    }
    focusEditorialTarget(target);
  }

  useEffect(() => {
    const title = form.title.trim();
    if (title.length < 8) {
      setRelatedHits([]);
      setDuplicateHits([]);
      setLinkHits([]);
      return;
    }
    const handle = window.setTimeout(() => {
      startTransition(async () => {
        const ctx = await fetchEditorialAssistantContextAction({
          articleId,
          title: form.title,
          categoryId: form.categoryId || null,
          city: form.city,
          province: form.province,
        });
        setRelatedHits(ctx.relatedHits);
        setDuplicateHits(ctx.duplicateHits);
        setLinkHits(ctx.linkHits);
      });
    }, 450);
    return () => window.clearTimeout(handle);
  }, [
    articleId,
    form.title,
    form.categoryId,
    form.city,
    form.province,
  ]);

  const result: EditorialAssistantResult = useMemo(() => {
    const snapshot = buildInfoSpotDraftSnapshot({
      ...form,
      selectedTags,
      relatedHits,
      duplicateHits,
      linkHits,
    });
    return engine.analyzeSync(snapshot);
  }, [form, selectedTags, relatedHits, duplicateHits, linkHits]);

  const quality = result.suggestions.find((s) => s.kind === "quality");
  const category = result.suggestions.find((s) => s.kind === "category");
  const tags = result.suggestions.find((s) => s.kind === "tag");
  const geo = result.suggestions.filter((s) => s.kind === "geo");
  const seo = result.suggestions.filter((s) => s.kind === "seo");
  const call = result.suggestions.find((s) => s.kind === "call");
  const banner = result.suggestions.find((s) => s.kind === "banner");
  const duplicates = result.suggestions.find((s) => s.kind === "duplicate");
  const related = result.suggestions.find((s) => s.kind === "related");
  const links = result.suggestions.find((s) => s.kind === "link");
  const summary = result.suggestions.find((s) => s.kind === "summary");
  const tagList = (tags?.meta?.tags as string[] | undefined) ?? [];

  return (
    <aside
      className="space-y-6 rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-[var(--is-bg)] p-5"
      aria-label="Asistente Editorial"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--is-muted)]">
          Asistente Editorial
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--is-muted)]">
          Sugerencias por reglas. Nunca modifica tu texto solo.
          {pending ? " · Buscando relacionados…" : null}
        </p>
      </div>

      <section className={`rounded-lg border px-4 py-3 ${severityClass(quality?.severity ?? "info")}`}>
        <p className="text-xs font-semibold uppercase tracking-wide">Calidad editorial</p>
        <p className="mt-1 text-lg font-semibold">{result.qualityLabel}</p>
        <p className="mt-1 text-sm opacity-80">
          Completitud {result.completenessPercent}% · Score {result.score}
        </p>
      </section>

      <section>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--is-muted)]">
          Checklist
        </p>
        <ul className="mt-3 space-y-2">
          {result.checklist.map((item) => {
            const target = !item.ok ? resolveChecklistFocusTarget(item.id) : null;
            return (
              <li key={item.id} className="flex items-start gap-2 text-sm">
                <span aria-hidden>{item.ok ? "✅" : "⬜"}</span>
                {target ? (
                  <button
                    type="button"
                    onClick={() => goTo(target)}
                    className="text-left text-[var(--is-muted)] underline-offset-2 hover:text-[var(--is-accent)] hover:underline"
                  >
                    {item.label}
                    {item.required ? "" : " (opcional)"}
                  </button>
                ) : (
                  <span className={item.ok ? "text-[var(--is-fg)]" : "text-[var(--is-muted)]"}>
                    {item.label}
                    {item.required ? "" : " (opcional)"}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {category ? (
        <section className="rounded-lg border border-[var(--is-border)] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--is-muted)]">
            {category.title}
          </p>
          <p className="mt-2 text-base font-semibold">{category.message}</p>
          {category.action?.type === "applyCategory" && onApplyCategory ? (
            <button
              type="button"
              className="is-btn is-btn-secondary mt-3 h-9 px-3 text-xs"
              onClick={() => {
                const payload = category.action?.payload as { categoryId: string };
                onApplyCategory(payload.categoryId);
              }}
            >
              Aplicar sugerencia
            </button>
          ) : null}
        </section>
      ) : null}

      {tagList.length > 0 ? (
        <section className="rounded-lg border border-[var(--is-border)] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--is-muted)]">
            {tags?.title ?? "Etiquetas sugeridas"}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {tagList.map((tag) => {
              const active = selectedTags.some(
                (t) => t.toLowerCase() === tag.toLowerCase(),
              );
              return (
                <button
                  key={tag}
                  type="button"
                  className={`rounded-full border px-3 py-1 text-xs ${
                    active
                      ? "border-[var(--is-accent)] bg-[var(--is-accent)]/10"
                      : "border-[var(--is-border)]"
                  }`}
                  onClick={() => {
                    const next = active
                      ? selectedTags.filter((t) => t.toLowerCase() !== tag.toLowerCase())
                      : [...selectedTags, tag];
                    setSelectedTags(next);
                    onApplyTags?.(next);
                  }}
                >
                  {tag}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-[var(--is-muted)]">
            Las etiquetas se guardan en esta sesión como palabras clave (aún no hay taxonomía
            persistente).
          </p>
        </section>
      ) : null}

      {geo.length > 0 ? (
        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--is-muted)]">
            Geolocalización
          </p>
          {geo.map((g) => (
            <SuggestionNavItem
              key={g.id}
              suggestion={g}
              onNavigate={goTo}
            />
          ))}
        </section>
      ) : null}

      {seo.length > 0 ? (
        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--is-muted)]">
            SEO
          </p>
          <ul className="space-y-2">
            {seo.map((s) => (
              <li key={s.id}>
                <SuggestionNavItem suggestion={s} onNavigate={goTo} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {call ? (
        <section className={`rounded-lg border px-4 py-3 ${severityClass("info")}`}>
          <p className="text-sm font-semibold">{call.title}</p>
          <p className="mt-1 text-sm">{call.message}</p>
          <p className="mt-2 text-xs text-[var(--is-muted)]">
            No se crea automáticamente. Usá el panel de convocatoria en el evento vinculado.
          </p>
        </section>
      ) : null}

      {banner ? (
        <section className={`rounded-lg border px-4 py-3 ${severityClass("info")}`}>
          <p className="text-sm font-semibold">{banner.title}</p>
          <p className="mt-1 text-xs text-[var(--is-muted)]">
            Revisá Distribución / portada. No se destaca sola.
          </p>
        </section>
      ) : null}

      {duplicates ? (
        <section className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-950">{duplicates.title}</p>
          <RelatedList
            items={(duplicates.meta?.items as EditorialRelatedHit[] | undefined) ?? []}
          />
        </section>
      ) : null}

      {related ? (
        <section className="rounded-lg border border-[var(--is-border)] px-4 py-3">
          <p className="text-sm font-semibold">{related.title}</p>
          <RelatedList
            items={(related.meta?.items as EditorialRelatedHit[] | undefined) ?? []}
          />
        </section>
      ) : null}

      {links ? (
        <section className="rounded-lg border border-[var(--is-border)] px-4 py-3">
          <p className="text-sm font-semibold">{links.title}</p>
          <p className="mt-1 text-xs text-[var(--is-muted)]">
            No se insertan solos en el cuerpo. Abrí y enlazá manualmente.
          </p>
          <RelatedList
            items={(links.meta?.items as EditorialRelatedHit[] | undefined) ?? []}
          />
        </section>
      ) : null}

      {summary ? (
        <section className="rounded-lg border border-[var(--is-border)] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--is-muted)]">
            {summary.title}
          </p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--is-muted)]">Categoría</dt>
              <dd>{result.summary.category ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--is-muted)]">Alcance</dt>
              <dd>{result.summary.scope ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--is-muted)]">Portada</dt>
              <dd>{result.summary.hasCover ? "Sí" : "No"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--is-muted)]">Ubicación</dt>
              <dd className="text-right">{result.summary.locationLabel ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--is-muted)]">SEO</dt>
              <dd>{result.summary.seoOk ? "OK" : "Pendiente"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--is-muted)]">Score</dt>
              <dd>{result.summary.score}</dd>
            </div>
          </dl>
        </section>
      ) : null}
    </aside>
  );
}
