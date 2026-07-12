"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { findFiguresMissingAlt, findFiguresMissingCredit } from "@repo/editor";
import { slugifyTitle } from "@/lib/slug";
import { toDatetimeLocalValue } from "@/lib/dates";
import { CoverImageField, type CoverAssetOption } from "@/components/redaccion/cover-image-field";
import { ClfEventPicker } from "@/components/redaccion/clf-event-picker";
import { PublishChecklist } from "@/components/redaccion/publish-checklist";
import { EditorialActionsPanel } from "@/components/redaccion/editorial-actions-panel";
import { EditorialVisualEditor } from "@/components/redaccion/visual-editor/editorial-visual-editor";
import { buildArticlePublishChecklist } from "@/lib/launch-content";
import { STATUS_LABELS, type ArticleStatus } from "@/lib/article-status";
import type { InfoSpotContentTag, InfoSpotPermissionSubject } from "@repo/db";
import { autosaveArticleDraftAction } from "@/app/actions/articles";

type CategoryOption = { id: string; name: string; slug: string };

type LinkedClfAsset = {
  linkId: string;
  usageType: "COVER" | "INLINE" | "GALLERY";
  sortOrder: number;
  captionOverride: string | null;
  url: string;
  thumbnailUrl: string | null;
  credit: string | null;
  photographerName: string | null;
};

type ArticleFormProps = {
  mode: "create" | "edit";
  action: (formData: FormData) => Promise<void> | void;
  categories: CategoryOption[];
  assets: CoverAssetOption[];
  canPublish: boolean;
  isDirector?: boolean;
  subject: InfoSpotPermissionSubject;
  authorLabel?: string;
  clf?: {
    eventId: number | null;
    albumId: number | null;
    eventTitle: string | null;
    albumTitle: string | null;
    linkedAssets: LinkedClfAsset[];
  };
  latestReturn?: {
    message: string;
    createdAt: Date | string;
    authorName: string;
  } | null;
  initial?: {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    content: string;
    categoryId: string | null;
    coverImageId: string | null;
    coverCredit?: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
    publishedAt: Date | string | null;
    status: ArticleStatus;
    contentTag?: InfoSpotContentTag | null;
    sourceName?: string | null;
    sourceUrl?: string | null;
    factCheckedAt?: Date | string | null;
    authorId?: number | null;
    updatedAt?: Date | string | null;
    returnedAt?: Date | string | null;
    submittedForReviewAt?: Date | string | null;
  };
};

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

const fieldClass =
  "mt-2 w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] bg-white px-3 py-3 text-base text-[var(--is-text)] outline-none focus:border-[var(--is-accent)] focus:ring-2 focus:ring-[var(--is-accent)]/20";
const labelClass = "text-sm font-semibold text-[var(--is-text)]";
const panelClass =
  "rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-[var(--is-surface)] p-5 space-y-4";

export function ArticleForm({
  mode,
  action,
  categories,
  assets,
  canPublish,
  isDirector = false,
  subject,
  authorLabel,
  clf,
  latestReturn,
  initial,
}: ArticleFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const [status] = useState<ArticleStatus>(initial?.status ?? "DRAFT");
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [seoTitle, setSeoTitle] = useState(initial?.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(initial?.seoDescription ?? "");
  const [contentTag, setContentTag] = useState<InfoSpotContentTag>(
    initial?.contentTag ?? "NEEDS_REVIEW",
  );
  const [sourceName, setSourceName] = useState(initial?.sourceName ?? "");
  const [sourceUrl, setSourceUrl] = useState(initial?.sourceUrl ?? "");
  const [factChecked, setFactChecked] = useState(Boolean(initial?.factCheckedAt));
  const [coverImageId, setCoverImageId] = useState(initial?.coverImageId ?? "");
  const [coverCredit, setCoverCredit] = useState(initial?.coverCredit ?? "");
  const [metaOpen, setMetaOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [expectedUpdatedAt, setExpectedUpdatedAt] = useState(
    initial?.updatedAt ? new Date(initial.updatedAt).toISOString() : null,
  );
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingLock = useRef(false);

  const autoSlug = useMemo(() => slugifyTitle(title), [title]);
  const figuresMissingCredit = useMemo(() => findFiguresMissingCredit(content), [content]);
  const figuresMissingAlt = useMemo(() => findFiguresMissingAlt(content), [content]);
  const creditOk =
    figuresMissingCredit.length === 0 &&
    (!coverImageId || Boolean(coverCredit?.trim() || initial?.coverCredit?.trim()));

  const checklist = useMemo(
    () =>
      buildArticlePublishChecklist({
        title,
        excerpt,
        content,
        categoryId: categoryId || null,
        coverImageId: coverImageId || null,
        authorId: initial?.authorId ?? 1,
        publishedAt: initial?.publishedAt,
        seoTitle,
        seoDescription,
        slug,
        contentTag,
        sourceName,
        factChecked,
        creditOk,
      }),
    [
      title,
      excerpt,
      content,
      categoryId,
      coverImageId,
      initial?.authorId,
      initial?.publishedAt,
      seoTitle,
      seoDescription,
      slug,
      contentTag,
      sourceName,
      factChecked,
      creditOk,
    ],
  );

  const markDirty = useCallback(() => {
    setSaveState((prev) => (prev === "saving" ? prev : "dirty"));
  }, []);

  const runAutosave = useCallback(async () => {
    if (mode !== "edit" || !initial?.id || !formRef.current) return;
    if (savingLock.current) return;

    savingLock.current = true;
    setSaveState("saving");
    setSaveError(null);
    try {
      const formData = new FormData(formRef.current);
      // El servidor nunca publica desde autosave; conserva PUBLISHED/UNPUBLISHED.
      if (expectedUpdatedAt) formData.set("expectedUpdatedAt", expectedUpdatedAt);
      const result = await autosaveArticleDraftAction(initial.id, formData);
      if (!result.ok) {
        setSaveState("error");
        setSaveError(result.error);
        return;
      }
      if (result.updatedAt) setExpectedUpdatedAt(result.updatedAt);
      setSaveState("saved");
    } catch {
      setSaveState("error");
      setSaveError("No se pudo guardar automáticamente.");
    } finally {
      savingLock.current = false;
    }
  }, [expectedUpdatedAt, initial?.id, mode]);

  useEffect(() => {
    if (mode !== "edit") return;
    if (saveState !== "dirty") return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      void runAutosave();
    }, 4000);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [saveState, content, title, excerpt, categoryId, seoTitle, seoDescription, sourceName, runAutosave, mode]);

  const saveLabel =
    saveState === "saving"
      ? "Guardando…"
      : saveState === "saved"
        ? "Guardado"
        : saveState === "dirty"
          ? "Cambios sin guardar"
          : saveState === "error"
            ? "Error al guardar"
            : "Listo";

  const metaPanel = (
    <div className="space-y-5">
      <input type="hidden" name="status" value={status} />

      {mode === "edit" && initial ? (
        <EditorialActionsPanel
          articleId={initial.id}
          status={status}
          subject={subject}
          returnedAt={initial.returnedAt}
          submittedForReviewAt={initial.submittedForReviewAt}
          latestReturn={latestReturn}
          checklistMissing={checklist.filter((i) => i.required && !i.ok).map((i) => i.label)}
          canPublish={canPublish}
          isDirector={isDirector}
        />
      ) : (
        <div className={panelClass}>
          <p className={labelClass}>Estado</p>
          <p className="text-sm text-[var(--is-text-secondary)]">{STATUS_LABELS[status]}</p>
          {!canPublish ? (
            <p className="text-xs text-[var(--is-muted)]">
              Podés guardar y luego enviar a revisión. No podés publicar.
            </p>
          ) : (
            <p className="text-xs text-[var(--is-muted)]">
              Guardá el borrador y usá el flujo editorial para revisar o publicar.
            </p>
          )}
        </div>
      )}

      <div className={panelClass}>
        <label className={labelClass} htmlFor="categoryId">
          Categoría {status === "PUBLISHED" ? "*" : ""}
        </label>
        <select
          id="categoryId"
          name="categoryId"
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            markDirty();
          }}
          className={fieldClass}
        >
          <option value="">Sin categoría</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className={panelClass}>
        <label className={labelClass} htmlFor="slug">
          Slug *
        </label>
        <input
          id="slug"
          value={slug || autoSlug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
            markDirty();
          }}
          className={fieldClass}
        />
        <p className="text-xs text-[var(--is-muted)]">/noticias/{slug || autoSlug || "…"}</p>
      </div>

      <div className={panelClass}>
        <p className={labelClass}>Autor</p>
        <p className="text-sm text-[var(--is-text-secondary)]">
          {authorLabel || "Autor de la nota"}
        </p>
      </div>

      <div className={panelClass}>
        <CoverImageField
          initialCoverImageId={coverImageId || null}
          initialCredit={coverCredit}
          assets={assets}
          onChange={(next) => {
            setCoverImageId(next.id);
            setCoverCredit(next.credit);
            markDirty();
          }}
        />
      </div>

      <div className={panelClass}>
        <div>
          <label className={labelClass} htmlFor="sourceName">
            Fuente verificada *
          </label>
          <input
            id="sourceName"
            name="sourceName"
            value={sourceName}
            onChange={(e) => {
              setSourceName(e.target.value);
              markDirty();
            }}
            className={fieldClass}
            placeholder="Ej: Organizador / gacetilla / CLF evento #123"
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="sourceUrl">
            URL de fuente (opcional)
          </label>
          <input
            id="sourceUrl"
            name="sourceUrl"
            type="url"
            value={sourceUrl}
            onChange={(e) => {
              setSourceUrl(e.target.value);
              markDirty();
            }}
            className={fieldClass}
            placeholder="https://…"
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="contentTag">
            Tag editorial (interno)
          </label>
          <select
            id="contentTag"
            name="contentTag"
            value={contentTag}
            onChange={(e) => {
              setContentTag(e.target.value as InfoSpotContentTag);
              markDirty();
            }}
            className={fieldClass}
          >
            <option value="NEEDS_REVIEW">NEEDS_REVIEW</option>
            <option value="DEMO">DEMO</option>
            <option value="REAL">REAL</option>
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="publishedAt">
            Fecha de publicación
          </label>
          <input
            id="publishedAt"
            name="publishedAt"
            type="datetime-local"
            defaultValue={toDatetimeLocalValue(initial?.publishedAt)}
            className={fieldClass}
            onChange={markDirty}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="seoTitle">
            SEO título
          </label>
          <input
            id="seoTitle"
            name="seoTitle"
            value={seoTitle}
            onChange={(e) => {
              setSeoTitle(e.target.value);
              markDirty();
            }}
            className={fieldClass}
            maxLength={70}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="seoDescription">
            SEO descripción
          </label>
          <textarea
            id="seoDescription"
            name="seoDescription"
            rows={3}
            value={seoDescription}
            onChange={(e) => {
              setSeoDescription(e.target.value);
              markDirty();
            }}
            className={fieldClass}
            maxLength={170}
          />
        </div>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="markFactChecked"
            checked={factChecked}
            onChange={(e) => {
              setFactChecked(e.target.checked);
              markDirty();
            }}
            className="mt-1"
          />
          <span>Confirmé la revisión factual (fact-check).</span>
        </label>
      </div>

      <PublishChecklist items={checklist} />

      {figuresMissingCredit.length > 0 || figuresMissingAlt.length > 0 ? (
        <div className="rounded-[var(--is-radius-md)] border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          {figuresMissingAlt.length > 0 ? (
            <p>Hay imágenes sin texto alternativo.</p>
          ) : null}
          {figuresMissingCredit.length > 0 ? (
            <p className="mt-1">Hay imágenes sin crédito: no se puede publicar así.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  return (
    <form
      ref={formRef}
      action={action}
      className="space-y-8"
      onInput={markDirty}
      onSubmit={() => {
        if (status === "PUBLISHED" && (!creditOk || figuresMissingAlt.length > 0)) {
          // El servidor también valida; feedback inmediato.
        }
      }}
    >
      <input type="hidden" name="slug" value={slug || autoSlug} />

      <div className="sticky top-0 z-20 -mx-4 border-b border-[var(--is-border)] bg-white/95 px-4 py-3 backdrop-blur sm:-mx-0 sm:rounded-[var(--is-radius-md)] sm:border sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--is-accent)]">
              Escritura
            </p>
            <p
              className={`mt-1 text-sm ${
                saveState === "error"
                  ? "text-red-700"
                  : saveState === "dirty"
                    ? "text-amber-800"
                    : "text-[var(--is-muted)]"
              }`}
            >
              {saveLabel}
              {saveError ? ` — ${saveError}` : null}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] px-4 text-sm font-medium lg:hidden"
              onClick={() => setMetaOpen(true)}
            >
              Metadatos
            </button>
            {mode === "edit" && initial ? (
              <Link
                href={`/redaccion/noticias/${initial.id}/preview`}
                className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] px-4 text-sm font-medium"
              >
                Preview
              </Link>
            ) : null}
            {mode === "edit" ? (
              <button
                type="button"
                disabled={pending || saveState === "saving"}
                className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] px-4 text-sm font-medium disabled:opacity-50"
                onClick={() => {
                  startTransition(() => {
                    void runAutosave();
                  });
                }}
              >
                Guardar
              </button>
            ) : null}
            <button
              type="submit"
              disabled={pending}
              className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-5 text-sm font-semibold text-white hover:bg-[var(--is-accent-hover)] disabled:opacity-60"
            >
              Guardar borrador
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="mx-auto w-full max-w-3xl space-y-8">
          <div>
            <label className={labelClass} htmlFor="title">
              Título *
            </label>
            <input
              id="title"
              name="title"
              required
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (!slugTouched) setSlug(slugifyTitle(e.target.value));
                markDirty();
              }}
              className={`${fieldClass} border-0 border-b border-[var(--is-border)] px-0 text-3xl font-semibold tracking-tight shadow-none focus:ring-0 sm:text-4xl`}
              placeholder="Título de la nota"
            />
            <p className="mt-3 text-xs text-[var(--is-muted)]">
              URL: /noticias/{slug || autoSlug || "…"}
            </p>
          </div>

          <div>
            <label className={labelClass} htmlFor="excerpt">
              Bajada {status === "PUBLISHED" ? "*" : ""}
            </label>
            <textarea
              id="excerpt"
              name="excerpt"
              rows={3}
              value={excerpt}
              onChange={(e) => {
                setExcerpt(e.target.value);
                markDirty();
              }}
              className={`${fieldClass} text-lg leading-relaxed`}
              placeholder="Resumen claro para listados y redes"
            />
          </div>

          <div>
            <div className="mb-3 flex items-end justify-between gap-3">
              <label className={labelClass}>Cuerpo</label>
              <p className="text-xs text-[var(--is-muted)]">Editor visual · se guarda en Markdown</p>
            </div>
            <EditorialVisualEditor
              initialMarkdown={initial?.content ?? ""}
              articleId={initial?.id}
              onMarkdownChange={(md) => {
                setContent(md);
              }}
              onDirtyChange={() => markDirty()}
              onCoverImported={() => {
                markDirty();
                window.location.reload();
              }}
            />
          </div>

          {mode === "edit" && initial && clf ? (
            <ClfEventPicker
              articleId={initial.id}
              initialEventId={clf.eventId}
              initialAlbumId={clf.albumId}
              initialEventTitle={clf.eventTitle}
              initialAlbumTitle={clf.albumTitle}
              linkedAssets={clf.linkedAssets}
            />
          ) : mode === "create" ? (
            <p className="rounded-[var(--is-radius-md)] border border-dashed border-[var(--is-border-strong)] bg-[var(--is-surface)] p-5 text-sm text-[var(--is-muted)]">
              Guardá el borrador primero para vincular un evento y fotografías de ComprameLaFoto.
            </p>
          ) : null}
        </div>

        <aside className="hidden xl:block">{metaPanel}</aside>
      </div>

      {metaOpen ? (
        <div className="fixed inset-0 z-40 xl:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Cerrar metadatos"
            onClick={() => setMetaOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 w-full max-w-md overflow-y-auto bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold">Metadatos</p>
              <button
                type="button"
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--is-radius-sm)] border border-[var(--is-border)]"
                onClick={() => setMetaOpen(false)}
              >
                ✕
              </button>
            </div>
            {metaPanel}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3 border-t border-[var(--is-border)] pt-6">
        <Link
          href="/redaccion"
          className="inline-flex min-h-11 items-center justify-center rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] px-5 text-sm font-medium"
        >
          Volver a la redacción
        </Link>
      </div>
    </form>
  );
}
