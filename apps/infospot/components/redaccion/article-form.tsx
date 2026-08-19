"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  extractEditorialFigures,
  findFiguresMissingAlt,
  findFiguresMissingCredit,
} from "@repo/editor";
import { slugifyTitle } from "@/lib/slug";
import { toDatetimeLocalValue } from "@/lib/dates";
import { type CoverAssetOption } from "@/components/redaccion/cover-image-field";
import { CoverImageModal, CoverSummaryCard } from "@/components/redaccion/cover-image-modal";
import { CoverFocalEditor } from "@/components/redaccion/cover-focal-editor";
import {
  ArticleLocationFields,
  defaultArticleLocationValue,
  type ArticleLocationValue,
} from "@/components/redaccion/article-location-fields";
import { articleLocationSummary } from "@/lib/editorial/article-location";
import { PublishChecklist } from "@/components/redaccion/publish-checklist";
import { StatusBadge } from "@/components/redaccion/status-badge";
import { EditorialActionsPanel } from "@/components/redaccion/editorial-actions-panel";
import {
  EditorialVisualEditor,
  type EditorialVisualEditorHandle,
} from "@/components/redaccion/visual-editor/editorial-visual-editor";
import { MaterialLibraryPanel } from "@/components/redaccion/material-library-panel";
import { EditorialIntelligencePanel } from "@/components/redaccion/editorial-intelligence-panel";
import { ArticlePublishToolbar } from "@/components/redaccion/article-publish-toolbar";
import { EditorConfigAccordion } from "@/components/redaccion/editor-config-accordion";
import { AiImportButton, AiImportDialog } from "@/components/ai-import";
import { buildArticlePublishChecklist } from "@/lib/launch-content";
import {
  evaluateEditorialPhotosForPublish,
  type EditorialPhotoChecklistInput,
} from "@/lib/editorial-photos/checklist";
import { STATUS_LABELS, type ArticleStatus } from "@/lib/article-status";
import type { InfoSpotPermissionSubject } from "@repo/db/permissions";
import { autosaveArticleDraftAction } from "@/app/actions/articles";
import { removeArticleAssetLinkAction } from "@/app/actions/clf-link";
import {
  ensureEditorialPhotoAltTextAction,
  removeEditorialPhotoUsageAction,
} from "@/app/actions/editorial-photos";
import type { AiImportMergeMode, ArticleFormImportValues } from "@/lib/ai-import";
import {
  focusEditorialTarget,
  type EditorialFocusTarget,
} from "@/lib/editorial-intelligence/focus-targets";

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
  usageId?: string | null;
  sourcePhotoId?: number | null;
  altText?: string | null;
  coverageTitle?: string | null;
  albumTitle?: string | null;
  availability?: "ready" | "processing" | "unavailable";
  processStatus?: string | null;
  editorialLicenseStatus?: string | null;
  commercialStatus?: string | null;
  hasDerivative?: boolean | null;
};

type ClfChecklistPhoto = EditorialPhotoChecklistInput & { usageId: string };

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
    /** Misma validación server-side de fotos CLF al publicar. */
    checklistPhotos?: ClfChecklistPhoto[];
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
    coverCaption?: string | null;
    coverSourceType?: "UPLOAD" | "CLF_PHOTO" | null;
    coverUrl?: string | null;
    geographicScope?: string | null;
    countryCode?: string | null;
    countryName?: string | null;
    province?: string | null;
    city?: string | null;
    placeName?: string | null;
    address?: string | null;
    formattedAddress?: string | null;
    latitude?: number | null;
    longitude?: number | null;
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
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const [status] = useState<ArticleStatus>(initial?.status ?? "DRAFT");
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [categoryId, setCategoryId] = useState(() => {
    const fromServer = initial?.categoryId ?? "";
    if (typeof window !== "undefined" && initial?.id && !fromServer) {
      try {
        return sessionStorage.getItem(`infospot.article.category.${initial.id}`) || "";
      } catch {
        return "";
      }
    }
    return fromServer;
  });
  const [seoTitle, setSeoTitle] = useState(initial?.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(initial?.seoDescription ?? "");
  const [sourceName, setSourceName] = useState(initial?.sourceName ?? "");
  const [sourceUrl, setSourceUrl] = useState(initial?.sourceUrl ?? "");
  const [coverImageId, setCoverImageId] = useState(initial?.coverImageId ?? "");
  const [coverCredit, setCoverCredit] = useState(initial?.coverCredit ?? "");
  const [coverCaption, setCoverCaption] = useState(initial?.coverCaption ?? "");
  const [location, setLocation] = useState<ArticleLocationValue>(() => {
    const fromServer = defaultArticleLocationValue({
      geographicScope: (initial?.geographicScope as ArticleLocationValue["geographicScope"]) || "",
      countryCode: initial?.countryCode || "AR",
      countryName: initial?.countryName || "Argentina",
      province: initial?.province || "",
      city: initial?.city || "",
      placeName: initial?.placeName || "",
      address: initial?.address || "",
      formattedAddress: initial?.formattedAddress || "",
      latitude: initial?.latitude != null ? String(initial.latitude) : "",
      longitude: initial?.longitude != null ? String(initial.longitude) : "",
    });
    // Tras un Server Action Next puede remontar el form con props aún sin alcance.
    // Recuperar la última elección local de esta nota.
    if (typeof window !== "undefined" && initial?.id && !fromServer.geographicScope) {
      try {
        const cached = sessionStorage.getItem(`infospot.article.scope.${initial.id}`);
        if (cached) {
          return { ...fromServer, geographicScope: cached as ArticleLocationValue["geographicScope"] };
        }
      } catch {
        /* private mode */
      }
    }
    return fromServer;
  });
  /** Panel de herramientas (Asistente o Material) como overlay, en cualquier ancho. */
  const [sideDrawer, setSideDrawer] = useState<null | "library" | "assistant">(null);
  /** Palabras clave de sesión (sin persistencia Prisma todavía). */
  const [sessionTags, setSessionTags] = useState<string[]>([]);
  /** Selector de portada (modal): la biblioteca ya no se despliega inline. */
  const [coverModalOpen, setCoverModalOpen] = useState(false);
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
  const [localChecklistPhotos, setLocalChecklistPhotos] = useState<ClfChecklistPhoto[]>(
    () => clf?.checklistPhotos ?? [],
  );
  const [unlinkingLinkId, setUnlinkingLinkId] = useState<string | null>(null);
  const [savingAltLinkId, setSavingAltLinkId] = useState<string | null>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingLock = useRef(false);
  const pendingDirtyRef = useRef(false);
  /** true solo tras «Limpiar ubicación» — permite persistir geographicScope null. */
  const locationClearedRef = useRef(false);
  /** true solo tras «Eliminar portada» — permite persistir coverImageId null. */
  const coverImageClearedRef = useRef(false);
  /**
   * true solo si el cuerpo fue tocado por una edición real del editor
   * (onUpdate de Tiptap, nunca por la hidratación inicial). Sin esto, un
   * `content` vacío en el primer render (props de servidor incompletas)
   * sería indistinguible de que el redactor vació el cuerpo a propósito.
   */
  const contentTouchedRef = useRef(false);
  const saveStateRef = useRef<SaveState>("idle");
  saveStateRef.current = saveState;
  const [previewPending, setPreviewPending] = useState(false);

  const autoSlug = useMemo(() => slugifyTitle(title), [title]);

  /** Siempre el borrador más reciente al disparar autosave (evita pisar alcance con un save viejo). */
  const draftRef = useRef({
    title,
    slug,
    autoSlug,
    excerpt,
    content,
    categoryId,
    coverImageId,
    coverCredit,
    coverCaption,
    seoTitle,
    seoDescription,
    sourceName,
    sourceUrl,
    expectedUpdatedAt,
    location,
  });
  draftRef.current = {
    title,
    slug,
    autoSlug,
    excerpt,
    content,
    categoryId,
    coverImageId,
    coverCredit,
    coverCaption,
    seoTitle,
    seoDescription,
    sourceName,
    sourceUrl,
    expectedUpdatedAt,
    location,
  };

  /** Actualiza el snapshot ANTES del re-render (crítico para <select> + autosave). */
  const touchDraft = useCallback(
    (partial: Partial<(typeof draftRef)["current"]>) => {
      draftRef.current = { ...draftRef.current, ...partial };
    },
    [],
  );

  useEffect(() => {
    setLocalLinkedAssets(clf?.linkedAssets ?? []);
  }, [clf?.linkedAssets]);

  useEffect(() => {
    setLocalChecklistPhotos(clf?.checklistPhotos ?? []);
  }, [clf?.checklistPhotos]);

  const figuresMissingCredit = useMemo(() => findFiguresMissingCredit(content), [content]);
  const figuresMissingAlt = useMemo(() => findFiguresMissingAlt(content), [content]);
  const creditOk =
    figuresMissingCredit.length === 0 &&
    (!coverImageId || Boolean(coverCredit?.trim() || initial?.coverCredit?.trim()));

  const checklist = useMemo(() => {
    const editorial = buildArticlePublishChecklist({
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
    });
    const clfPhotos = evaluateEditorialPhotosForPublish(localChecklistPhotos);
    return [...editorial, ...clfPhotos];
  }, [
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
    localChecklistPhotos,
  ]);

  const markDirty = useCallback(() => {
    setSaveState((prev) => {
      if (prev === "saving") {
        pendingDirtyRef.current = true;
        return prev;
      }
      return "dirty";
    });
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
    if (savingLock.current) {
      pendingDirtyRef.current = true;
      return;
    }

    savingLock.current = true;
    setSaveState("saving");
    setSaveError(null);
    // Snapshot al momento de enviar: draftRef se actualiza en cada render, así un
    // autosave que arrancó tarde no pisa el alcance elegido durante un save previo.
    const snap = draftRef.current;
    let nextState: SaveState | null = null;
    try {
      const result = await autosaveArticleDraftAction(initial.id, {
        title: snap.title.trim() || "Sin título",
        slug: (snap.slug || snap.autoSlug || "sin-titulo").trim(),
        excerpt: snap.excerpt,
        content: snap.content,
        contentCleared: contentTouchedRef.current && !snap.content.trim() ? "1" : undefined,
        categoryId: snap.categoryId || "",
        coverImageId: snap.coverImageId || null,
        coverCredit: snap.coverImageId ? snap.coverCredit : undefined,
        // Enviar siempre el pie si hay portada (también vacío → opcional en schema).
        coverCaption: snap.coverImageId ? snap.coverCaption : undefined,
        coverImageCleared: coverImageClearedRef.current ? "1" : undefined,
        seoTitle: snap.seoTitle || undefined,
        seoDescription: snap.seoDescription || undefined,
        sourceName: snap.sourceName || undefined,
        sourceUrl: snap.sourceUrl || undefined,
        expectedUpdatedAt: snap.expectedUpdatedAt || undefined,
        // Siempre string (también ""): si mandamos null se omite en el server y
        // un autosave viejo puede pisar el alcance con null vía Zod.
        geographicScope: snap.location.geographicScope,
        countryCode: snap.location.countryCode,
        countryName: snap.location.countryName,
        province: snap.location.province,
        city: snap.location.city,
        placeName: snap.location.placeName,
        address: snap.location.address,
        formattedAddress: snap.location.formattedAddress,
        latitude: snap.location.latitude,
        longitude: snap.location.longitude,
        locationCleared: locationClearedRef.current ? "1" : undefined,
      });
      if (result.ok && snap.location.geographicScope) {
        locationClearedRef.current = false;
      }
      if (result.ok && snap.coverImageId) {
        coverImageClearedRef.current = false;
      }
      if (!result.ok) {
        nextState = "error";
        setSaveError(result.error);
        return;
      }
      if (result.updatedAt) setExpectedUpdatedAt(result.updatedAt);
      nextState = "saved";
    } catch {
      nextState = "error";
      setSaveError("No se pudo guardar automáticamente.");
    } finally {
      savingLock.current = false;
      if (pendingDirtyRef.current) {
        pendingDirtyRef.current = false;
        setSaveState("dirty");
      } else if (nextState) {
        setSaveState(nextState);
      }
    }
  }, [initial?.id, mode]);

  // Debounce corto: guardar mientras se escribe (incl. ubicación/alcance).
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
    coverCaption,
    coverImageId,
    slug,
    location,
    runAutosave,
    mode,
  ]);

  // Al ocultar la pestaña / cerrar la ventana: forzar guardado pendiente.
  useEffect(() => {
    if (mode !== "edit") return;

    const flushIfDirty = () => {
      if (savingLock.current) {
        pendingDirtyRef.current = true;
        return;
      }
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

  // Espera cualquier guardado sin terminar (en curso o debounced pendiente) y
  // dispara uno si quedó "dirty". Se usa antes de navegar a Vista previa: una
  // navegación SPA (Link) desmonta este componente y el efecto de debounce
  // de abajo cancela el setTimeout pendiente en su cleanup — sin este flush
  // explícito, la última edición sin guardar nunca llega al servidor.
  const flushPendingSave = useCallback(async () => {
    if (mode !== "edit" || !initial?.id) return;
    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }
    let guard = 0;
    while (savingLock.current && guard < 100) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      guard += 1;
    }
    if (saveStateRef.current === "dirty" || saveStateRef.current === "error") {
      await runAutosave();
    }
  }, [initial?.id, mode, runAutosave]);

  // Red de seguridad para cualquier otro desmontaje (navegar a otra sección,
  // cerrar un drawer que desmonta el árbol, etc.): mejor esfuerzo, sin esperar
  // la respuesta porque un cleanup síncrono no puede hacer await.
  useEffect(() => {
    if (mode !== "edit") return;
    return () => {
      void flushPendingSave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    if (!sideDrawer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSideDrawer(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sideDrawer]);

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
        if (linkId.startsWith("usage:") && asset.usageId) {
          const result = await removeEditorialPhotoUsageAction(asset.usageId);
          if (!result.ok) {
            setSaveError(result.error);
            setSaveState("error");
            return;
          }
        } else {
          const result = await removeArticleAssetLinkAction(initial.id, linkId);
          if (!result.ok) {
            setSaveError(result.error);
            setSaveState("error");
            return;
          }
        }
        setLocalLinkedAssets((prev) => prev.filter((a) => a.linkId !== linkId));
        if (asset.usageId) {
          setLocalChecklistPhotos((prev) => prev.filter((p) => p.usageId !== asset.usageId));
        }
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

  const saveAltText = useCallback(
    async (altText: string, asset: LinkedClfAsset) => {
      if (!initial?.id) return;
      setSavingAltLinkId(asset.linkId);
      try {
        const result = await ensureEditorialPhotoAltTextAction({
          articleId: initial.id,
          altText,
          usageId: asset.usageId,
          assetId: asset.assetId,
          sourcePhotoId: asset.sourcePhotoId,
          usageType: asset.usageType,
        });
        if (!result.ok) {
          setSaveError(result.error);
          setSaveState("error");
          return;
        }
        const nextAlt = altText.trim() || null;
        setLocalLinkedAssets((prev) =>
          prev.map((a) =>
            a.linkId === asset.linkId
              ? {
                  ...a,
                  altText: nextAlt,
                  usageId: result.usageId,
                }
              : a,
          ),
        );
        setLocalChecklistPhotos((prev) => {
          const usageId = result.usageId;
          if (!usageId) return prev;
          const idx = prev.findIndex((p) => p.usageId === usageId);
          if (idx >= 0) {
            return prev.map((p, i) => (i === idx ? { ...p, altText: nextAlt } : p));
          }
          // Usage nuevo: completar checklist con datos del asset local.
          return [
            ...prev,
            {
              usageId,
              processStatus:
                asset.processStatus ||
                (asset.availability === "processing"
                  ? "PROCESSING"
                  : asset.availability === "unavailable"
                    ? "FAILED"
                    : "READY"),
              photographerName: asset.photographerName,
              credit: asset.credit,
              editorialLicenseStatus: asset.editorialLicenseStatus || "PENDING",
              hasDerivative: asset.hasDerivative ?? true,
              commercialStatus: asset.commercialStatus || "AVAILABLE",
              usageType: asset.usageType,
              altText: nextAlt,
            },
          ];
        });
        setSaveError(null);
        setSaveState("saved");
      } catch {
        setSaveError("No se pudo guardar la descripción de la foto.");
        setSaveState("error");
      } finally {
        setSavingAltLinkId(null);
      }
    },
    [initial?.id],
  );

  const usedAssetIds = useMemo(() => {
    const ids = new Set<string>();
    for (const fig of extractEditorialFigures(content)) {
      if (fig.assetId) ids.add(fig.assetId);
    }
    return ids;
  }, [content]);

  const assistantFormState = useMemo(() => {
    const lat = location.latitude.trim() ? Number(location.latitude) : null;
    const lng = location.longitude.trim() ? Number(location.longitude) : null;
    return {
      title,
      excerpt,
      content,
      slug,
      seoTitle,
      seoDescription,
      categoryId,
      categories,
      geographicScope: location.geographicScope || null,
      countryName: location.countryName || null,
      countryCode: location.countryCode || null,
      province: location.province || null,
      city: location.city || null,
      placeName: location.placeName || null,
      latitude: lat != null && Number.isFinite(lat) ? lat : null,
      longitude: lng != null && Number.isFinite(lng) ? lng : null,
      hasCover: Boolean(coverImageId),
      hasAuthor: Boolean(initial?.authorId ?? authorLabel),
      hasSource: Boolean(sourceName.trim()),
      publishedAt: initial?.publishedAt
        ? new Date(initial.publishedAt).toISOString()
        : null,
      editorialPriority: null,
      selectedTags: sessionTags,
      linkedEventStartsAt: null,
      linkedEventTitle: clf?.eventTitle ?? null,
      hasPhotographerCall: false,
    };
  }, [
    title,
    excerpt,
    content,
    slug,
    seoTitle,
    seoDescription,
    categoryId,
    categories,
    location,
    coverImageId,
    initial?.authorId,
    initial?.publishedAt,
    authorLabel,
    sourceName,
    sessionTags,
    clf?.eventTitle,
  ]);

  const navigateToEditorialField = useCallback((target: EditorialFocusTarget) => {
    // El panel lateral ya está montado en el documento (accordions nativos):
    // focusEditorialTarget abre el <details> ancestro correspondiente solo.
    setSideDrawer(null);
    focusEditorialTarget(target);
  }, []);

  function removeCover() {
    coverImageClearedRef.current = true;
    setCoverImageId("");
    setCoverCredit("");
    setCoverCaption("");
    draftRef.current = { ...draftRef.current, coverImageId: "", coverCredit: "", coverCaption: "" };
    markDirty();
  }

  const coverPreviewUrl =
    assets.find((a) => a.id === coverImageId)?.url ||
    linkedAssets.find((a) => a.assetId === coverImageId)?.url ||
    (initial?.coverImageId === coverImageId ? initial?.coverUrl ?? null : null) ||
    null;

  const locationSummary = articleLocationSummary(location);

  const assistantPanel = (
    <EditorialIntelligencePanel
      form={assistantFormState}
      articleId={initial?.id}
      onApplyCategory={(id) => {
        touchDraft({ categoryId: id });
        setCategoryId(id);
        if (initial?.id && typeof window !== "undefined") {
          try {
            sessionStorage.setItem(`infospot.article.category.${initial.id}`, id);
          } catch {
            /* private mode */
          }
        }
        markDirty();
      }}
      onApplyTags={(tags) => setSessionTags(tags)}
      onNavigateToField={navigateToEditorialField}
    />
  );

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
      savingAltLinkId={savingAltLinkId}
      onSaveAltText={(altText, asset) => saveAltText(altText, asset)}
      onInsertInline={(attrs) => {
        editorRef.current?.insertImage(attrs);
      }}
      onRemoveFromText={(assetId) => {
        const removed = editorRef.current?.removeAssetFromText(assetId);
        if (removed) {
          setHighlightedAssetId(null);
          markDirty();
        }
      }}
      onGoToUsed={(assetId) => {
        editorRef.current?.scrollToAsset(assetId);
        setHighlightedAssetId(assetId);
        const el = document.getElementById(`material-asset-${assetId}`);
        el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }}
    />
  );

  const sidebarAccordion = (
    <div className="space-y-3">
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="contentTag" value="REAL" />

      <EditorConfigAccordion
        sections={[
          {
            id: "cover",
            title: "Portada",
            hint: coverPreviewUrl ? "Seleccionada" : "Sin portada",
            defaultOpen: true,
            children: (
              <div id="cover-section-title">
                <CoverSummaryCard
                  previewUrl={coverPreviewUrl}
                  credit={coverCredit}
                  caption={coverCaption}
                  onChange={() => setCoverModalOpen(true)}
                  onRemove={removeCover}
                />
                {coverFocal ? (
                  <div className="mt-4 border-t border-[var(--is-border)] pt-4">
                    <CoverFocalEditor
                      usageId={coverFocal.usageId}
                      imageSrc={coverFocal.imageSrc}
                      initialFocalX={coverFocal.focalX}
                      initialFocalY={coverFocal.focalY}
                    />
                  </div>
                ) : null}
              </div>
            ),
          },
          {
            id: "location",
            title: "Ubicación y alcance",
            hint: locationSummary,
            children: (
              <ArticleLocationFields
                embedded
                value={location}
                onChange={(next, meta) => {
                  if (meta?.cleared) locationClearedRef.current = true;
                  else if (next.geographicScope) locationClearedRef.current = false;
                  touchDraft({ location: next });
                  setLocation(next);
                  if (initial?.id && typeof window !== "undefined") {
                    try {
                      const scopeKey = `infospot.article.scope.${initial.id}`;
                      if (meta?.cleared || !next.geographicScope) {
                        sessionStorage.removeItem(scopeKey);
                      } else {
                        sessionStorage.setItem(scopeKey, next.geographicScope);
                      }
                    } catch {
                      /* private mode */
                    }
                  }
                  markDirty();
                }}
              />
            ),
          },
          {
            id: "publish",
            title: "Revisión y publicación",
            hint: STATUS_LABELS[status],
            defaultOpen: true,
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
                  persistenceBlockReason={
                    saveState === "saving"
                      ? "Esperá a que termine de guardarse antes de enviar o publicar."
                      : saveState === "dirty"
                        ? "Hay cambios sin guardar. Esperá el guardado automático o guardá antes de continuar."
                        : saveState === "error"
                          ? saveError ||
                            "No se pudo guardar. Corregí el error antes de enviar o publicar."
                          : null
                  }
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
            id: "meta",
            title: "Metadatos",
            hint: "URL, fuente, autor",
            children: (
              <div className="space-y-4">
                <p className="text-sm leading-relaxed text-[var(--is-muted)]">
                  La categoría se edita en el formulario principal (arriba del cuerpo).
                  {categoryId
                    ? ` Actual: ${categories.find((c) => c.id === categoryId)?.name ?? "seleccionada"}.`
                    : " Todavía sin categoría."}
                </p>
                <div>
                  <label className={labelClass} htmlFor="slug">
                    URL pública *
                  </label>
                  <input
                    id="slug"
                    value={slug || autoSlug}
                    onChange={(e) => {
                      const next = e.target.value;
                      setSlugTouched(true);
                      touchDraft({ slug: next });
                      setSlug(next);
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
                      const next = e.target.value;
                      touchDraft({ sourceName: next });
                      setSourceName(next);
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
                      const next = e.target.value;
                      touchDraft({ sourceUrl: next });
                      setSourceUrl(next);
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
                      const next = e.target.value;
                      touchDraft({ seoTitle: next });
                      setSeoTitle(next);
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
                      const next = e.target.value;
                      touchDraft({ seoDescription: next });
                      setSeoDescription(next);
                      markDirty();
                    }}
                    className={fieldClass}
                    maxLength={170}
                  />
                </div>
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
                        Portada y cuerpo admiten imágenes propias (subida) y fotos de cobertura
                        CLF. Podés combinar ambas. El material CLF se prepara en el Asistente.
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
                        Agregar material CLF
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
  }

  return (
    <form
      ref={formRef}
      action={action}
      className="space-y-6"
      // No usar onInput en el form: en <select> el evento `input` corre ANTES de
      // `change` y puede encolar un autosave con categoryId/alcance todavía viejos.
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
        <p
          className={`text-sm transition-colors duration-200 ${
            saveState === "error"
              ? "text-red-700"
              : saveState === "dirty"
                ? "text-amber-800"
                : saveState === "saved"
                  ? "text-teal-800"
                  : "text-[var(--is-muted)]"
          }`}
          role="status"
        >
          {saveLabel}
          {saveError ? ` — ${saveError}` : null}
        </p>
        <div className="flex max-w-full flex-wrap items-center gap-2 overflow-x-hidden">
          {mode === "edit" && initial ? (
            <button
              type="button"
              className="is-btn is-btn-secondary disabled:opacity-60"
              disabled={previewPending}
              onClick={() => {
                const previewHref = `/redaccion/noticias/${initial.id}/preview`;
                if (saveState === "idle" || saveState === "saved") {
                  router.push(previewHref);
                  return;
                }
                setPreviewPending(true);
                void flushPendingSave().then(() => {
                  setPreviewPending(false);
                  // Si el guardado terminó en error, no navegar: el contenido
                  // local queda intacto y el error ya se muestra arriba
                  // (toolbar de guardado), accionable antes de reintentar.
                  if (saveStateRef.current === "error") return;
                  router.push(previewHref);
                });
              }}
            >
              {previewPending ? "Guardando…" : "Vista previa"}
            </button>
          ) : null}
          <button
            type="submit"
            disabled={pending || saveState === "saving"}
            className="is-btn is-btn-secondary disabled:opacity-60"
          >
            {mode === "edit"
              ? status === "PUBLISHED"
                ? "Guardar cambios"
                : "Guardar"
              : "Guardar borrador"}
          </button>
          {mode === "edit" && initial ? (
            <ArticlePublishToolbar
              articleId={initial.id}
              status={status}
              subject={subject}
              canPublish={canPublish}
              checklistMissing={checklistMissing}
              hideStatusPill
            />
          ) : null}
        </div>
      </div>

      {/* Herramientas auxiliares: acompañan la escritura sin competir con Publicar. */}
      <div className="-mx-4 flex flex-wrap items-center gap-1 border-b border-[var(--is-border)]/70 px-4 py-2 sm:mx-0 sm:px-1">
        <span className="is-editorial-section-label mr-1">Herramientas</span>
        {canUseAiImport ? (
          <AiImportButton onClick={() => setAiImportOpen(true)} />
        ) : null}
        <button
          type="button"
          className="is-btn is-btn-secondary !min-h-10 px-3 text-xs"
          onClick={() => setSideDrawer("assistant")}
        >
          Asistente
        </button>
        <button
          type="button"
          className="is-btn is-btn-secondary !min-h-10 px-3 text-xs"
          onClick={() => setSideDrawer("library")}
        >
          Material
        </button>
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
            <textarea
              id="title"
              name="title"
              required
              rows={2}
              value={title}
              onChange={(e) => {
                // Una sola línea lógica: Enter no inserta saltos; el wrap es visual.
                const next = e.target.value.replace(/\n+/g, " ");
                const nextSlug = !slugTouched ? slugifyTitle(next) : slug;
                touchDraft({
                  title: next,
                  ...( !slugTouched ? { slug: nextSlug, autoSlug: nextSlug } : {}),
                });
                setTitle(next);
                if (!slugTouched) setSlug(nextSlug);
                markDirty();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
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
                const next = e.target.value;
                touchDraft({ excerpt: next });
                setExcerpt(next);
                markDirty();
              }}
              className="is-input-dek"
              placeholder="Bajada — una o dos oraciones"
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="categoryId">
              Categoría {status === "PUBLISHED" || status === "READY_TO_PUBLISH" ? "*" : ""}
            </label>
            <select
              id="categoryId"
              name="categoryId"
              value={categoryId}
              onChange={(e) => {
                const next = e.target.value;
                touchDraft({ categoryId: next });
                setCategoryId(next);
                if (initial?.id && typeof window !== "undefined") {
                  try {
                    const key = `infospot.article.category.${initial.id}`;
                    if (next) sessionStorage.setItem(key, next);
                    else sessionStorage.removeItem(key);
                  } catch {
                    /* private mode */
                  }
                }
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
            <p className="mt-2 text-xs leading-relaxed text-[var(--is-muted)]">
              Obligatoria para publicar. Podés cambiarla en cualquier momento, incluso si la nota
              vino sugerida desde CLF.
            </p>
          </div>

          <div id="article-body-editor">
            <p className="mb-3 text-sm leading-relaxed text-[var(--is-muted)]">
              Cuerpo — podés insertar imágenes propias desde la barra del editor o desde la
              biblioteca CLF a la derecha. Se pueden combinar ambas fuentes.
            </p>
            <EditorialVisualEditor
              key={editorKey}
              ref={editorRef}
              initialMarkdown={content}
              articleId={initial?.id}
              clfAlbumId={clf?.albumId ?? null}
              onMarkdownChange={(md) => {
                contentTouchedRef.current = true;
                touchDraft({ content: md });
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
          </div>

          {mode === "create" ? (
            <p className="text-sm leading-relaxed text-[var(--is-muted)]">
              Guardá el borrador para vincular material editorial y usar la biblioteca CLF.
            </p>
          ) : null}
        </div>

        <aside className="lg:sticky lg:top-[var(--is-editor-rail-top)] lg:max-h-[var(--is-editor-rail-max-h)] lg:self-start lg:overflow-y-auto lg:overscroll-contain">
          <div className="is-editorial-panel is-editorial-panel--bordered space-y-5">
            <div className="flex items-center justify-between gap-2">
              <p className="is-editorial-section-label">Estado de la nota</p>
              <StatusBadge status={status} pendingReturn={Boolean(latestReturn)} />
            </div>

            <PublishChecklist items={checklist} />

            {sidebarAccordion}
          </div>
        </aside>
      </div>

      {/* Panel de herramientas: Asistente o Material, como overlay en cualquier ancho. */}
      {sideDrawer ? (
        <div className="is-editorial-drawer-overlay">
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
            aria-label={sideDrawer === "library" ? "Material editorial" : "Asistente Editorial"}
          >
            <div className="is-editorial-drawer__header">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`min-h-10 rounded-full px-3 text-sm font-medium ${
                    sideDrawer === "assistant"
                      ? "bg-[var(--is-accent)] text-white"
                      : "border border-[var(--is-border)]"
                  }`}
                  onClick={() => setSideDrawer("assistant")}
                >
                  Asistente
                </button>
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
              {sideDrawer === "assistant" ? assistantPanel : library}
            </div>
          </div>
        </div>
      ) : null}

      <CoverImageModal
        open={coverModalOpen}
        onClose={() => setCoverModalOpen(false)}
        articleId={initial?.id}
        initialCoverImageId={coverImageId || null}
        initialCredit={coverCredit}
        initialCaption={coverCaption}
        assets={assets}
        clfOptions={(() => {
          const fromLinks = localLinkedAssets
            .filter((a) => Boolean(a.assetId) && Boolean(a.url))
            .map((a) => ({
              assetId: a.assetId as string,
              url: a.url,
              thumbnailUrl: a.thumbnailUrl,
              credit: a.credit,
              photographerName: a.photographerName,
              albumTitle: a.albumTitle,
              coverageTitle: a.coverageTitle,
              caption: a.captionOverride,
            }));
          if (
            initial?.coverImageId &&
            initial.coverSourceType === "CLF_PHOTO" &&
            initial.coverUrl &&
            !fromLinks.some((a) => a.assetId === initial.coverImageId)
          ) {
            fromLinks.unshift({
              assetId: initial.coverImageId,
              url: initial.coverUrl,
              thumbnailUrl: initial.coverUrl,
              credit: initial.coverCredit ?? null,
              photographerName: null,
              albumTitle: clf?.albumTitle ?? null,
              coverageTitle: clf?.albumTitle ?? null,
              caption: initial.coverCaption ?? null,
            });
          }
          return fromLinks;
        })()}
        onConfirm={(next) => {
          if (!next.id) coverImageClearedRef.current = true;
          else coverImageClearedRef.current = false;
          setCoverImageId(next.id);
          setCoverCredit(next.credit);
          setCoverCaption(next.caption);
          draftRef.current = {
            ...draftRef.current,
            coverImageId: next.id,
            coverCredit: next.credit,
            coverCaption: next.caption,
          };
          markDirty();
        }}
      />

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
