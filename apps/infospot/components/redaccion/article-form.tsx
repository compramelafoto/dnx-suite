"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  extractEditorialFigures,
  findFiguresMissingAlt,
  findFiguresMissingCredit,
} from "@repo/editor";
import { slugifyTitle } from "@/lib/slug";
import { toDatetimeLocalValue } from "@/lib/dates";
import { CoverImageField, type CoverAssetOption } from "@/components/redaccion/cover-image-field";
import { CoverFocalEditor } from "@/components/redaccion/cover-focal-editor";
import { PublishChecklist } from "@/components/redaccion/publish-checklist";
import { EditorialActionsPanel } from "@/components/redaccion/editorial-actions-panel";
import {
  EditorialVisualEditor,
  type EditorialVisualEditorHandle,
} from "@/components/redaccion/visual-editor/editorial-visual-editor";
import { MaterialLibraryPanel } from "@/components/redaccion/material-library-panel";
import { EditorConfigAccordion } from "@/components/redaccion/editor-config-accordion";
import { AiImportButton, AiImportDialog } from "@/components/ai-import";
import { buildArticlePublishChecklist } from "@/lib/launch-content";
import { STATUS_LABELS, type ArticleStatus } from "@/lib/article-status";
import type { InfoSpotPermissionSubject } from "@repo/db";
import { autosaveArticleDraftAction } from "@/app/actions/articles";
import { removeArticleAssetLinkAction } from "@/app/actions/clf-link";
import type { AiImportMergeMode, ArticleFormImportValues } from "@/lib/ai-import";

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
  assetId?: string | null;
  coverageTitle?: string | null;
  albumTitle?: string | null;
  availability?: "ready" | "processing" | "unavailable";
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
  /** Encuadre de portada CLF (usage COVER). */
  coverFocal?: {
    usageId: string;
    imageSrc: string;
    focalX: number | null;
    focalY: number | null;
  } | null;
  latestReturn?: {
    message: string;
    createdAt: Date | string;
    authorName: string;
  } | null;
  /** Historia preparada por el Asistente Editorial. */
  fromAssistant?: boolean;
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
    contentTag?: string | null;
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

const fieldClass = "is-input mt-2";
const labelClass = "is-input-label";

/** Quita figuras editoriales del cuerpo por data-asset-id. */
function stripFiguresByAssetId(markdown: string, assetId: string): string {
  const escaped = assetId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `<figure\\b[^>]*data-asset-id=["']${escaped}["'][^>]*>[\\s\\S]*?<\\/figure>`,
    "gi",
  );
  return markdown.replace(re, "").replace(/\n{3,}/g, "\n\n").trim();
}

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
  coverFocal = null,
  latestReturn,
  fromAssistant = false,
  initial,
}: ArticleFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const editorRef = useRef<EditorialVisualEditorHandle>(null);
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
  const [sourceName, setSourceName] = useState(initial?.sourceName ?? "");
  const [sourceUrl, setSourceUrl] = useState(initial?.sourceUrl ?? "");
  const [coverImageId, setCoverImageId] = useState(initial?.coverImageId ?? "");
  const [coverCredit, setCoverCredit] = useState(initial?.coverCredit ?? "");
  /** Drawer móvil / tablet: biblioteca o configuración. */
  const [sideDrawer, setSideDrawer] = useState<null | "library" | "config">(null);
  /** Desktop: panel de configuración (SEO, publicación). */
  const [configOpen, setConfigOpen] = useState(false);
  const [highlightedAssetId, setHighlightedAssetId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [expectedUpdatedAt, setExpectedUpdatedAt] = useState(
    initial?.updatedAt ? new Date(initial.updatedAt).toISOString() : null,
  );
  const [aiImportOpen, setAiImportOpen] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const [importBanner, setImportBanner] = useState<string | null>(null);
  const [localLinkedAssets, setLocalLinkedAssets] = useState<LinkedClfAsset[]>(
    () => clf?.linkedAssets ?? [],
  );
  const [unlinkingLinkId, setUnlinkingLinkId] = useState<string | null>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingLock = useRef(false);
  const saveStateRef = useRef<SaveState>("idle");
  saveStateRef.current = saveState;

  useEffect(() => {
    setLocalLinkedAssets(clf?.linkedAssets ?? []);
  }, [clf?.linkedAssets]);

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
        contentTag: "REAL",
        sourceName,
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
      sourceName,
      creditOk,
    ],
  );

  const markDirty = useCallback(() => {
    setSaveState((prev) => (prev === "saving" ? prev : "dirty"));
  }, []);

  const hasExistingArticleValues = Boolean(
    title.trim() ||
      excerpt.trim() ||
      content.trim() ||
      categoryId ||
      seoTitle.trim() ||
      seoDescription.trim() ||
      sourceName.trim() ||
      sourceUrl.trim(),
  );

  const canUseAiImport = mode === "create" || status === "DRAFT" || !content.trim();

  const applyArticleImport = useCallback(
    (payload: {
      mode: AiImportMergeMode;
      articleValues?: ArticleFormImportValues;
      selectedSimilarEvent?: {
        source: string;
        id: string;
        title: string;
      } | null;
    }) => {
      const v = payload.articleValues;
      if (!v) return;
      const replace = payload.mode === "replace_all";
      const take = (current: string, next?: string) => {
        if (!next?.trim()) return current;
        if (replace || !current.trim()) return next;
        return current;
      };

      setTitle((cur) => take(cur, v.title));
      setExcerpt((cur) => take(cur, v.excerpt));
      setSeoTitle((cur) => take(cur, v.seoTitle));
      setSeoDescription((cur) => take(cur, v.seoDescription));
      setSourceName((cur) => take(cur, v.sourceName));
      setSourceUrl((cur) => take(cur, v.sourceUrl));
      setCoverCredit((cur) => take(cur, v.coverCredit));
      if (v.categoryId && (replace || !categoryId)) {
        setCategoryId(v.categoryId);
      }
      if (v.content?.trim() && (replace || !content.trim())) {
        setContent(v.content);
        setEditorKey((k) => k + 1);
      }
      if (v.title?.trim() && (!slugTouched || replace)) {
        setSlug(slugifyTitle(v.title));
        setSlugTouched(false);
      }
      const similarHint = payload.selectedSimilarEvent
        ? `Candidato ${payload.selectedSimilarEvent.source}: «${payload.selectedSimilarEvent.title}» (ID ${payload.selectedSimilarEvent.id}) — vinculalo manualmente si corresponde`
        : null;
      const notes = [
        v.notesForEditor,
        v.factCheckNotes,
        v.eventName ? `Evento: ${v.eventName}` : null,
        similarHint,
      ]
        .filter(Boolean)
        .join(" · ");
      setImportBanner(
        notes
          ? `Importación aplicada. Revisá: ${notes}`
          : "Importación aplicada. Revisá los campos antes de guardar.",
      );
      markDirty();
    },
    [categoryId, content, markDirty, slugTouched],
  );

  const runAutosave = useCallback(async () => {
    if (mode !== "edit" || !initial?.id) return;
    if (savingLock.current) return;

    savingLock.current = true;
    setSaveState("saving");
    setSaveError(null);
    try {
      // Guardar desde el estado React (no FormData del DOM): el cuerpo TipTap
      // y los campos controlados quedan sincronizados aunque se cierre la pestaña.
      const result = await autosaveArticleDraftAction(initial.id, {
        title: title.trim() || "Sin título",
        slug: (slug || autoSlug || "sin-titulo").trim(),
        excerpt,
        content,
        categoryId: categoryId || null,
        coverImageId: coverImageId || null,
        coverCredit: coverCredit || undefined,
        seoTitle: seoTitle || undefined,
        seoDescription: seoDescription || undefined,
        sourceName: sourceName || undefined,
        sourceUrl: sourceUrl || undefined,
        expectedUpdatedAt: expectedUpdatedAt || undefined,
      });
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
  }, [
    autoSlug,
    categoryId,
    content,
    coverCredit,
    coverImageId,
    excerpt,
    expectedUpdatedAt,
    initial?.id,
    mode,
    seoDescription,
    seoTitle,
    slug,
    sourceName,
    sourceUrl,
    title,
  ]);

  // Debounce corto: guardar mientras se escribe.
  useEffect(() => {
    if (mode !== "edit") return;
    if (saveState !== "dirty") return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      void runAutosave();
    }, 1200);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [
    saveState,
    content,
    title,
    excerpt,
    categoryId,
    seoTitle,
    seoDescription,
    sourceName,
    sourceUrl,
    coverCredit,
    coverImageId,
    slug,
    runAutosave,
    mode,
  ]);

  // Al ocultar la pestaña / cerrar la ventana: forzar guardado pendiente.
  useEffect(() => {
    if (mode !== "edit") return;

    const flushIfDirty = () => {
      if (savingLock.current) return;
      if (saveStateRef.current !== "dirty" && saveStateRef.current !== "error") return;
      if (autosaveTimer.current) {
        clearTimeout(autosaveTimer.current);
        autosaveTimer.current = null;
      }
      void runAutosave();
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushIfDirty();
    };

    window.addEventListener("pagehide", flushIfDirty);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flushIfDirty);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [mode, runAutosave]);

  useEffect(() => {
    if (!sideDrawer && !configOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSideDrawer(null);
        setConfigOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sideDrawer, configOpen]);

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

  const checklistMissing = checklist.filter((i) => i.required && !i.ok).map((i) => i.label);
  const linkedAssets = useMemo(
    () =>
      localLinkedAssets.map((a) => ({
        ...a,
        coverageTitle: a.coverageTitle ?? clf?.albumTitle ?? null,
        albumTitle: a.albumTitle ?? clf?.albumTitle ?? null,
        availability:
          a.availability ??
          (a.thumbnailUrl || a.url ? ("ready" as const) : ("unavailable" as const)),
      })),
    [localLinkedAssets, clf?.albumTitle],
  );

  const unlinkAsset = useCallback(
    async (linkId: string, asset: LinkedClfAsset) => {
      if (!initial?.id) return;
      if (
        !window.confirm(
          asset.usageType === "COVER"
            ? "¿Quitar esta foto de portada de la nota?"
            : "¿Quitar esta foto de la nota?",
        )
      ) {
        return;
      }
      setUnlinkingLinkId(linkId);
      try {
        const result = await removeArticleAssetLinkAction(initial.id, linkId);
        if (!result.ok) {
          setSaveError(result.error);
          setSaveState("error");
          return;
        }
        setLocalLinkedAssets((prev) => prev.filter((a) => a.linkId !== linkId));
        if (asset.usageType === "COVER" && asset.assetId && coverImageId === asset.assetId) {
          setCoverImageId("");
          setCoverCredit("");
        }
        if (asset.assetId && asset.usageType === "INLINE") {
          const nextContent = stripFiguresByAssetId(content, asset.assetId);
          if (nextContent !== content) {
            setContent(nextContent);
            setEditorKey((k) => k + 1);
          }
        }
        markDirty();
      } catch {
        setSaveError("No se pudo quitar la foto.");
        setSaveState("error");
      } finally {
        setUnlinkingLinkId(null);
      }
    },
    [content, coverImageId, initial?.id, markDirty],
  );

  const usedAssetIds = useMemo(() => {
    const ids = new Set<string>();
    for (const fig of extractEditorialFigures(content)) {
      if (fig.assetId) ids.add(fig.assetId);
    }
    return ids;
  }, [content]);

  const library = (
    <MaterialLibraryPanel
      articleId={initial?.id}
      fromAssistant={fromAssistant}
      eventTitle={clf?.eventTitle}
      albumTitle={clf?.albumTitle}
      sourceName={sourceName}
      linkedAssets={linkedAssets}
      usedAssetIds={usedAssetIds}
      highlightedAssetId={highlightedAssetId}
      unlinkingLinkId={unlinkingLinkId}
      onUnlink={(linkId, asset) => unlinkAsset(linkId, asset)}
      onInsertInline={(attrs) => {
        editorRef.current?.insertImage(attrs);
      }}
      onGoToUsed={(assetId) => {
        editorRef.current?.scrollToAsset(assetId);
        setHighlightedAssetId(assetId);
        const el = document.getElementById(`material-asset-${assetId}`);
        el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }}
    />
  );

  const configPanel = (
    <div className="space-y-4">
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="contentTag" value="REAL" />

      <EditorConfigAccordion
        sections={[
          {
            id: "publish",
            title: "Publicación",
            hint: "Enviar, publicar o devolver — sin salir de la escritura",
            defaultOpen: false,
            children:
              mode === "edit" && initial ? (
                <EditorialActionsPanel
                  articleId={initial.id}
                  status={status}
                  subject={subject}
                  returnedAt={initial.returnedAt}
                  submittedForReviewAt={initial.submittedForReviewAt}
                  latestReturn={latestReturn}
                  checklistMissing={checklistMissing}
                  canPublish={canPublish}
                  isDirector={isDirector}
                />
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-[var(--is-text-secondary)]">{STATUS_LABELS[status]}</p>
                  <p className="text-xs text-[var(--is-muted)]">
                    Guardá el borrador. Después podés enviarlo a revisión o publicarlo desde
                    Configuración.
                  </p>
                </div>
              ),
          },
          {
            id: "checklist",
            title: "Checklist",
            hint:
              checklistMissing.length > 0
                ? `${checklistMissing.length} pendiente${checklistMissing.length === 1 ? "" : "s"}`
                : "Listo para publicar",
            children: (
              <>
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
              </>
            ),
          },
          {
            id: "meta",
            title: "Metadatos",
            hint: "Categoría, URL, fuente",
            children: (
              <div className="space-y-4">
                <div>
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
                <div>
                  <label className={labelClass} htmlFor="slug">
                    URL pública *
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
                  <p className="mt-2 text-xs text-[var(--is-muted)]">
                    /noticias/{slug || autoSlug || "…"}
                  </p>
                </div>
                <div>
                  <p className={labelClass}>Autor</p>
                  <p className="mt-2 text-sm text-[var(--is-text-secondary)]">
                    {authorLabel || "Autor de la historia"}
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
                    onChange={(e) => {
                      setSourceName(e.target.value);
                      markDirty();
                    }}
                    className={fieldClass}
                    placeholder="Ej: Organizador / gacetilla"
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
              </div>
            ),
          },
          {
            id: "seo",
            title: "SEO",
            hint: "Opcional — al final del proceso",
            children: (
              <div className="space-y-4">
                <div>
                  <label className={labelClass} htmlFor="seoTitle">
                    Título SEO
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
                    Descripción SEO
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
              </div>
            ),
          },
          {
            id: "cover",
            title: "Portada avanzada",
            hint: "Subir, elegir o encuadrar",
            children: (
              <div className="space-y-6">
                <CoverImageField
                  articleId={initial?.id}
                  initialCoverImageId={coverImageId || null}
                  initialCredit={coverCredit}
                  assets={assets}
                  onChange={(next) => {
                    setCoverImageId(next.id);
                    setCoverCredit(next.credit);
                    markDirty();
                  }}
                />
                {coverFocal ? (
                  <CoverFocalEditor
                    usageId={coverFocal.usageId}
                    imageSrc={coverFocal.imageSrc}
                    initialFocalX={coverFocal.focalX}
                    initialFocalY={coverFocal.focalY}
                  />
                ) : null}
              </div>
            ),
          },
          ...(mode === "edit" && initial
            ? [
                {
                  id: "material",
                  title: "Material editorial",
                  hint: "Preparación fuera del editor",
                  children: (
                    <div className="space-y-3 text-sm leading-relaxed text-[var(--is-muted)]">
                      <p>
                        Las fotografías se preparan en el Asistente Editorial. Desde acá solo
                        consumís la biblioteca.
                      </p>
                      {clf?.eventTitle ? (
                        <p className="text-[var(--is-text)]">
                          Evento vinculado: <strong>{clf.eventTitle}</strong>
                        </p>
                      ) : (
                        <p>Todavía no hay evento vinculado.</p>
                      )}
                      {clf?.albumTitle ? (
                        <p className="text-[var(--is-text)]">
                          Cobertura: <strong>{clf.albumTitle}</strong>
                        </p>
                      ) : null}
                      <Link
                        href={`/redaccion/asistente?mode=photos&articleId=${initial.id}`}
                        className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-4 text-sm font-semibold text-white"
                      >
                        Agregar material
                      </Link>
                    </div>
                  ),
                } as const,
              ]
            : []),
        ]}
      />
    </div>
  );

  function closeDrawers() {
    setSideDrawer(null);
    setConfigOpen(false);
  }

  return (
    <form
      ref={formRef}
      action={action}
      className="space-y-6"
      onInput={markDirty}
      onSubmit={(e) => {
        if (mode === "edit") {
          e.preventDefault();
          startTransition(() => {
            void runAutosave();
          });
          return;
        }
        if (status === "PUBLISHED" && (!creditOk || figuresMissingAlt.length > 0)) {
          // El servidor también valida; feedback inmediato.
        }
      }}
    >
      <input type="hidden" name="slug" value={slug || autoSlug} />

      <div className="is-editorial-toolbar -mx-4 sm:-mx-0">
        <div>
          <p className="is-editorial-eyebrow">Escritura</p>
          <p
            className={`mt-1 text-sm transition-colors duration-200 ${
              saveState === "error"
                ? "text-red-700"
                : saveState === "dirty"
                  ? "text-amber-800"
                  : saveState === "saved"
                    ? "text-teal-800"
                    : "text-[var(--is-muted)]"
            }`}
          >
            {saveLabel}
            {saveError ? ` — ${saveError}` : null}
          </p>
        </div>
        <div className="flex max-w-full flex-wrap items-center gap-2 overflow-x-hidden">
          {canUseAiImport ? (
            <AiImportButton onClick={() => setAiImportOpen(true)} />
          ) : null}
          <button
            type="button"
            className="is-btn is-btn-secondary lg:hidden"
            onClick={() => setSideDrawer("library")}
          >
            Material
          </button>
          <button
            type="button"
            className="is-btn is-btn-secondary"
            onClick={() => {
              if (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) {
                setConfigOpen(true);
              } else {
                setSideDrawer("config");
              }
            }}
          >
            Configuración
            {checklistMissing.length > 0 ? (
              <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-amber-100 px-1.5 text-[10px] font-bold text-amber-900">
                {checklistMissing.length}
              </span>
            ) : null}
          </button>
          {mode === "edit" && initial ? (
            <Link
              href={`/redaccion/noticias/${initial.id}/preview`}
              className="is-btn is-btn-secondary"
            >
              Vista previa
            </Link>
          ) : null}
          <button
            type="submit"
            disabled={pending || saveState === "saving"}
            className="is-btn is-btn-primary disabled:opacity-60"
          >
            {mode === "edit"
              ? status === "PUBLISHED"
                ? "Guardar cambios"
                : "Guardar"
              : "Guardar borrador"}
          </button>
        </div>
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="is-writing-surface space-y-10">
          {importBanner ? (
            <p
              className="rounded-[var(--is-radius-sm)] border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm leading-relaxed text-emerald-950"
              role="status"
            >
              {importBanner}
            </p>
          ) : null}

          {fromAssistant ? (
            <p className="text-sm leading-relaxed text-[var(--is-muted)]">
              El asistente ya preparó el contexto. Acá solo escribís: el material está en la
              biblioteca.
            </p>
          ) : null}

          <div>
            <label className="sr-only" htmlFor="title">
              Título
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
              className="is-input-title"
              placeholder="Título de la historia"
            />
          </div>

          <div>
            <label className="sr-only" htmlFor="excerpt">
              Bajada
            </label>
            <textarea
              id="excerpt"
              name="excerpt"
              rows={2}
              value={excerpt}
              onChange={(e) => {
                setExcerpt(e.target.value);
                markDirty();
              }}
              className="is-input-dek"
              placeholder="Bajada — una o dos oraciones"
            />
          </div>

          <EditorialVisualEditor
            key={editorKey}
            ref={editorRef}
            initialMarkdown={content}
            articleId={initial?.id}
            onMarkdownChange={(md) => {
              setContent(md);
            }}
            onDirtyChange={() => markDirty()}
            onSelectedAssetChange={(id) => {
              setHighlightedAssetId(id);
              if (id) {
                const el = document.getElementById(`material-asset-${id}`);
                el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
              }
            }}
            onCoverImported={() => {
              markDirty();
              // No hacer router.refresh() acá: remonta el formulario y borra
              // el texto local que todavía no se guardó.
            }}
          />

          {mode === "create" ? (
            <p className="text-sm leading-relaxed text-[var(--is-muted)]">
              Guardá el borrador para vincular material editorial y usar la biblioteca.
            </p>
          ) : null}
        </div>

        <aside className="hidden lg:block">
          <div className="is-editorial-rail is-editorial-panel is-editorial-panel--bordered">
            {library}
          </div>
        </aside>
      </div>

      {/* Drawer móvil: biblioteca o configuración */}
      {sideDrawer ? (
        <div className="is-editorial-drawer-overlay lg:hidden">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Cerrar panel"
            onClick={closeDrawers}
          />
          <div
            className="is-editorial-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={sideDrawer === "library" ? "Material editorial" : "Configuración"}
          >
            <div className="is-editorial-drawer__header">
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`min-h-10 rounded-full px-3 text-sm font-medium ${
                    sideDrawer === "library"
                      ? "bg-[var(--is-accent)] text-white"
                      : "border border-[var(--is-border)]"
                  }`}
                  onClick={() => setSideDrawer("library")}
                >
                  Material
                </button>
                <button
                  type="button"
                  className={`min-h-10 rounded-full px-3 text-sm font-medium ${
                    sideDrawer === "config"
                      ? "bg-[var(--is-accent)] text-white"
                      : "border border-[var(--is-border)]"
                  }`}
                  onClick={() => setSideDrawer("config")}
                >
                  Configuración
                </button>
              </div>
              <button
                type="button"
                className="is-btn is-btn-icon"
                onClick={closeDrawers}
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
            <div className="is-editorial-drawer__body">
              {sideDrawer === "library" ? library : configPanel}
            </div>
          </div>
        </div>
      ) : null}

      {/* Drawer desktop: solo configuración */}
      {configOpen ? (
        <div className="is-editorial-drawer-overlay hidden lg:block">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Cerrar configuración"
            onClick={closeDrawers}
          />
          <div
            className="is-editorial-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Configuración editorial"
          >
            <div className="is-editorial-drawer__header">
              <div>
                <p className="is-editorial-eyebrow">Fuera de la escritura</p>
                <h2 className="mt-1 is-font-serif text-xl font-semibold">
                  Configuración
                </h2>
              </div>
              <button
                type="button"
                className="is-btn is-btn-icon"
                onClick={closeDrawers}
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
            <div className="is-editorial-drawer__body">{configPanel}</div>
          </div>
        </div>
      ) : null}

      {canUseAiImport ? (
        <AiImportDialog
          open={aiImportOpen}
          onClose={() => setAiImportOpen(false)}
          context="ARTICLE"
          categories={categories}
          hasExistingValues={hasExistingArticleValues}
          onApply={applyArticleImport}
        />
      ) : null}
    </form>
  );
}
