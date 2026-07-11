"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { slugifyTitle } from "@/lib/slug";
import { toDatetimeLocalValue } from "@/lib/dates";
import { CoverImageField, type CoverAssetOption } from "@/components/redaccion/cover-image-field";
import { ArticleStatusActions } from "@/components/redaccion/article-status-actions";
import { ClfEventPicker } from "@/components/redaccion/clf-event-picker";
import { PublishChecklist } from "@/components/redaccion/publish-checklist";
import { buildArticlePublishChecklist } from "@/lib/launch-content";
import type { ArticleStatus } from "@/lib/article-status";
import type { InfoSpotContentTag } from "@repo/db";

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
  clf?: {
    eventId: number | null;
    albumId: number | null;
    eventTitle: string | null;
    albumTitle: string | null;
    linkedAssets: LinkedClfAsset[];
  };
  initial?: {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    content: string;
    categoryId: string | null;
    coverImageId: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
    publishedAt: Date | string | null;
    status: ArticleStatus;
    contentTag?: InfoSpotContentTag | null;
    sourceName?: string | null;
    sourceUrl?: string | null;
    factCheckedAt?: Date | string | null;
    authorId?: number | null;
  };
};

const fieldClass =
  "mt-2 w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] bg-white px-3 py-3 text-base text-[var(--is-text)] outline-none focus:border-[var(--is-accent)] focus:ring-2 focus:ring-[var(--is-accent)]/20";
const labelClass = "text-sm font-semibold text-[var(--is-text)]";

export function ArticleForm({
  mode,
  action,
  categories,
  assets,
  canPublish,
  clf,
  initial,
}: ArticleFormProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const [status, setStatus] = useState<ArticleStatus>(initial?.status ?? "DRAFT");
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

  const autoSlug = useMemo(() => slugifyTitle(title), [title]);
  const checklist = useMemo(
    () =>
      buildArticlePublishChecklist({
        title,
        excerpt,
        content,
        categoryId: categoryId || null,
        coverImageId: initial?.coverImageId ?? null,
        authorId: initial?.authorId ?? 1,
        publishedAt: initial?.publishedAt,
        seoTitle,
        seoDescription,
        slug,
        contentTag,
        sourceName,
        factChecked,
      }),
    [
      title,
      excerpt,
      content,
      categoryId,
      initial?.coverImageId,
      initial?.authorId,
      initial?.publishedAt,
      seoTitle,
      seoDescription,
      slug,
      contentTag,
      sourceName,
      factChecked,
    ],
  );

  return (
    <form action={action} className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-6">
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
              }}
              className={fieldClass}
              placeholder="Título de la noticia"
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="slug">
              Slug *
            </label>
            <input
              id="slug"
              name="slug"
              required
              value={slug || autoSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              className={fieldClass}
            />
            <p className="mt-2 text-xs text-[var(--is-muted)]">URL: /noticias/{slug || autoSlug || "…"}</p>
          </div>

          <div>
            <label className={labelClass} htmlFor="excerpt">
              Extracto {status === "PUBLISHED" ? "*" : ""}
            </label>
            <textarea
              id="excerpt"
              name="excerpt"
              rows={3}
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              className={fieldClass}
              placeholder="Bajada breve para listados y redes"
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="content">
              Contenido (Markdown) {status === "PUBLISHED" ? "*" : ""}
            </label>
            <textarea
              id="content"
              name="content"
              rows={18}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className={`${fieldClass} font-mono text-sm leading-relaxed`}
              placeholder={"## Subtítulo\n\nPárrafo con **negrita** y [enlace](https://ejemplo.com)."}
            />
            <p className="mt-2 text-xs text-[var(--is-muted)]">
              Editor Markdown simple (MVP). TipTap queda para una etapa posterior.
            </p>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-[var(--is-radius)] border border-[var(--is-border)] bg-[var(--is-surface)] p-4">
            <label className={labelClass} htmlFor="status">
              Estado
            </label>
            <select
              id="status"
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as ArticleStatus)}
              className={fieldClass}
            >
              <option value="DRAFT">Borrador</option>
              {canPublish ? <option value="PUBLISHED">Publicada</option> : null}
              {mode === "edit" && canPublish ? (
                <option value="UNPUBLISHED">Despublicada</option>
              ) : null}
              {mode === "edit" ? <option value="ARCHIVED">Archivada</option> : null}
            </select>
          </div>

          <div className="rounded-[var(--is-radius)] border border-[var(--is-border)] bg-[var(--is-surface)] p-4">
            <label className={labelClass} htmlFor="categoryId">
              Categoría {status === "PUBLISHED" ? "*" : ""}
            </label>
            <select
              id="categoryId"
              name="categoryId"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
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

          <div className="rounded-[var(--is-radius)] border border-[var(--is-border)] bg-[var(--is-surface)] p-4">
            <CoverImageField
              initialCoverImageId={initial?.coverImageId}
              assets={assets}
            />
          </div>

          <div className="rounded-[var(--is-radius)] border border-[var(--is-border)] bg-[var(--is-surface)] p-4 space-y-4">
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
              />
              <p className="mt-2 text-xs text-[var(--is-muted)]">
                Si está vacío al publicar, se usa la fecha actual.
              </p>
            </div>
            <div>
              <label className={labelClass} htmlFor="seoTitle">
                SEO título
              </label>
              <input
                id="seoTitle"
                name="seoTitle"
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                className={fieldClass}
                maxLength={70}
              />
              <p
                className={`mt-2 text-xs tabular-nums ${
                  seoTitle.length > 60 ? "text-amber-700" : "text-[var(--is-muted)]"
                }`}
              >
                {seoTitle.length}/60 recomendado (máx. 70)
              </p>
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
                onChange={(e) => setSeoDescription(e.target.value)}
                className={fieldClass}
                maxLength={170}
              />
              <p
                className={`mt-2 text-xs tabular-nums ${
                  seoDescription.length > 155
                    ? "text-amber-700"
                    : "text-[var(--is-muted)]"
                }`}
              >
                {seoDescription.length}/155 recomendado (máx. 170)
              </p>
            </div>
            <div>
              <label className={labelClass} htmlFor="sourceName">
                Fuente verificada *
              </label>
              <input
                id="sourceName"
                name="sourceName"
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
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
                onChange={(e) => setSourceUrl(e.target.value)}
                className={fieldClass}
                placeholder="https://…"
              />
              <p className="mt-2 text-xs text-[var(--is-muted)]">
                Campos internos: no se muestran en el sitio público.
              </p>
            </div>
            <div>
              <label className={labelClass} htmlFor="contentTag">
                Etiqueta interna
              </label>
              <select
                id="contentTag"
                name="contentTag"
                value={contentTag}
                onChange={(e) => setContentTag(e.target.value as InfoSpotContentTag)}
                className={fieldClass}
              >
                <option value="NEEDS_REVIEW">NEEDS_REVIEW</option>
                <option value="DEMO">DEMO</option>
                <option value="REAL">REAL</option>
              </select>
              <p className="mt-2 text-xs text-[var(--is-muted)]">
                Solo visible en admin/redacción. Para salir al sitio público debe ser{" "}
                <strong>REAL</strong>.
              </p>
            </div>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                name="markFactChecked"
                checked={factChecked}
                onChange={(e) => setFactChecked(e.target.checked)}
                className="mt-1"
              />
              <span>
                Confirmé la revisión factual (fact-check). Obligatorio para publicar.
                {initial?.factCheckedAt ? (
                  <span className="mt-1 block text-xs text-[var(--is-muted)]">
                    Ya marcado previamente.
                  </span>
                ) : null}
              </span>
            </label>
          </div>

          <PublishChecklist items={checklist} />

          {mode === "edit" && initial ? (
            <div className="rounded-[var(--is-radius)] border border-[var(--is-border)] bg-[var(--is-surface)] p-4 space-y-3">
              <p className="text-sm font-semibold">Acciones rápidas</p>
              <ArticleStatusActions
                articleId={initial.id}
                status={initial.status}
                canPublish={canPublish}
              />
              <Link
                href={`/redaccion/noticias/${initial.id}/preview`}
                className="inline-flex min-h-11 items-center text-sm text-[var(--is-accent)] underline-offset-2 hover:underline"
              >
                Vista previa antes de publicar
              </Link>
            </div>
          ) : null}
        </aside>
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
        <p className="rounded-[var(--is-radius)] border border-dashed border-[var(--is-border-strong)] bg-[var(--is-surface)] p-4 text-sm text-[var(--is-muted)]">
          Guardá el borrador primero para vincular un evento y fotografías de ComprameLaFoto.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3 border-t border-[var(--is-border)] pt-6">
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-5 text-sm font-semibold text-white hover:bg-[var(--is-accent-hover)]"
        >
          {status === "PUBLISHED" ? "Guardar y publicar" : "Guardar borrador"}
        </button>
        <Link
          href="/redaccion"
          className="inline-flex min-h-11 items-center justify-center rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] px-5 text-sm font-medium"
        >
          Volver al listado
        </Link>
      </div>
    </form>
  );
}
