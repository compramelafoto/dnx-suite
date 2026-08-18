"use client";

import { useEffect, useId, useMemo, useState } from "react";
import {
  EDITORIAL_GALLERY_DEFAULT_INTERVAL_MS,
  EDITORIAL_GALLERY_MAX_IMAGES,
  EDITORIAL_GALLERY_MIN_IMAGES,
  validateEditorialGallery,
  type EditorialGalleryAttrs,
  type EditorialGalleryImageAttrs,
  type EditorialGalleryValidationResult,
} from "@repo/editor";
import { ClfEditorialPhotoSelector } from "@/components/editorial-photos/clf-editorial-photo-selector";

type WorkingImage = EditorialGalleryImageAttrs & { clfPhotoId?: number };

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (attrs: EditorialGalleryAttrs) => void;
  articleId?: string | null;
  coverageId?: string | null;
  /** Álbum CLF vinculado a la cobertura — habilita la pestaña CLF. */
  clfAlbumId?: number | null;
  /** Si se pasa, el diálogo abre en modo edición precargado. */
  initialAttrs?: EditorialGalleryAttrs | null;
};

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

function validationMessage(result: EditorialGalleryValidationResult): string {
  if (result.ok) return "";
  switch (result.error) {
    case "TOO_FEW_IMAGES":
      return `Se necesitan al menos ${EDITORIAL_GALLERY_MIN_IMAGES} fotos.`;
    case "TOO_MANY_IMAGES":
      return `Como máximo ${EDITORIAL_GALLERY_MAX_IMAGES} fotos por galería.`;
    case "DUPLICATE_IMAGE":
      return "Hay una foto repetida en la galería.";
    case "MISSING_ALT":
      return "Todas las fotos necesitan texto alternativo.";
    case "UNSAFE_URL":
      return "Una de las fotos tiene una URL no permitida.";
    default:
      return "Revisá la galería antes de insertar.";
  }
}

/**
 * "Insertar galería": elegí 2-20 fotos (biblioteca propia y/o álbum CLF
 * vinculado), ordenalas, completá alt/epígrafe/crédito y configurá el
 * slideshow. Mismo diálogo sirve para editar una galería ya insertada
 * (initialAttrs presente).
 */
export function InsertGalleryDialog({
  open,
  onClose,
  onSubmit,
  articleId,
  coverageId,
  clfAlbumId,
  initialAttrs,
}: Props) {
  const titleId = useId();
  const isEdit = Boolean(initialAttrs);

  const [tab, setTab] = useState<"infospot" | "clf">("infospot");
  const [images, setImages] = useState<WorkingImage[]>([]);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [autoplay, setAutoplay] = useState(true);
  const [intervalMs, setIntervalMs] = useState(EDITORIAL_GALLERY_DEFAULT_INTERVAL_MS);
  const [loop, setLoop] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setImages((initialAttrs?.images as WorkingImage[] | undefined) ?? []);
    setTitle(initialAttrs?.title ?? "");
    setCaption(initialAttrs?.caption ?? "");
    setAutoplay(initialAttrs?.autoplay ?? true);
    setIntervalMs(initialAttrs?.intervalMs ?? EDITORIAL_GALLERY_DEFAULT_INTERVAL_MS);
    setLoop(initialAttrs?.loop ?? true);
    setError(null);
    setTab("infospot");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset solo al abrir
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const selectedClfPhotoIds = useMemo(() => {
    const set = new Set<number>();
    for (const img of images) {
      if (img.source === "CLF" && img.clfPhotoId) set.add(img.clfPhotoId);
    }
    return set;
  }, [images]);

  if (!open) return null;

  function updateImage(id: string, patch: Partial<WorkingImage>) {
    setImages((prev) => prev.map((img) => (img.id === id ? { ...img, ...patch } : img)));
  }

  function removeImage(id: string) {
    setImages((prev) => prev.filter((img) => img.id !== id));
  }

  function moveImage(id: string, direction: -1 | 1) {
    setImages((prev) => {
      const index = prev.findIndex((img) => img.id === id);
      if (index < 0) return prev;
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const tmp = next[index]!;
      next[index] = next[target]!;
      next[target] = tmp;
      return next;
    });
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (images.length >= EDITORIAL_GALLERY_MAX_IMAGES) {
          setError(`Máximo ${EDITORIAL_GALLERY_MAX_IMAGES} fotos por galería.`);
          break;
        }
        const body = new FormData();
        body.set("file", file);
        body.set("purpose", "gallery");
        body.set("alt", "");
        body.set("caption", "");
        body.set("credit", "");
        if (articleId) body.set("articleId", articleId);

        const res = await fetch("/api/redaccion/upload", { method: "POST", body });
        const data = (await res.json()) as {
          asset?: { id: string; url: string; caption: string | null; credit: string | null };
          error?: string;
        };
        if (!res.ok || !data.asset) {
          throw new Error(data.error || "No se pudo subir una imagen");
        }
        const asset = data.asset;
        setImages((prev) => {
          if (prev.some((img) => img.source === "INFOSPOT" && img.assetId === asset.id)) {
            return prev;
          }
          return [
            ...prev,
            {
              id: uid("img"),
              source: "INFOSPOT",
              assetId: asset.id,
              photoId: null,
              previewUrl: asset.url,
              alt: "",
              caption: asset.caption || "",
              credit: asset.credit || "",
            },
          ];
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al subir imágenes");
    } finally {
      setUploading(false);
    }
  }

  function handleClfToggle(input: {
    clfPhotoId: number;
    photoId: string;
    deliverySrc: string | null;
    photographerName: string;
    usageId: string | null;
    selected: boolean;
  }) {
    if (!input.selected) {
      setImages((prev) =>
        prev.filter((img) => !(img.source === "CLF" && img.clfPhotoId === input.clfPhotoId)),
      );
      return;
    }
    if (images.length >= EDITORIAL_GALLERY_MAX_IMAGES) {
      setError(`Máximo ${EDITORIAL_GALLERY_MAX_IMAGES} fotos por galería.`);
      return;
    }
    setError(null);
    setImages((prev) => [
      ...prev,
      {
        id: uid("clf"),
        source: "CLF",
        assetId: null,
        photoId: input.photoId,
        clfPhotoId: input.clfPhotoId,
        previewUrl: input.deliverySrc || "",
        alt: "",
        photographerName: input.photographerName,
      },
    ]);
  }

  const missingAlt = images.filter((img) => !img.alt.trim());
  const missingCredit = images.filter(
    (img) => img.source === "INFOSPOT" && !(img.credit || "").trim(),
  );
  const canSubmit = images.length >= EDITORIAL_GALLERY_MIN_IMAGES && missingAlt.length === 0;

  function submit() {
    const attrs: EditorialGalleryAttrs = {
      id: initialAttrs?.id || uid("gallery"),
      title: title.trim() || undefined,
      caption: caption.trim() || undefined,
      autoplay,
      intervalMs:
        Number.isFinite(intervalMs) && intervalMs > 0
          ? intervalMs
          : EDITORIAL_GALLERY_DEFAULT_INTERVAL_MS,
      loop,
      // `images` trae además `clfPhotoId` (uso interno del diálogo, para
      // reflejar selección en ClfEditorialPhotoSelector); no forma parte del
      // contrato EditorialGalleryImageAttrs y el nodo/HTML lo ignora.
      images,
    };
    const validation = validateEditorialGallery(attrs);
    if (!validation.ok) {
      setError(validationMessage(validation));
      return;
    }
    onSubmit(attrs);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-white shadow-sm">
        <div className="border-b border-[var(--is-border)] px-6 py-4">
          <h2
            id={titleId}
            className="font-[family-name:var(--font-source-serif)] text-xl font-semibold"
          >
            {isEdit ? "Editar galería" : "Insertar galería"}
          </h2>
          <p className="mt-1 text-sm text-[var(--is-muted)]">
            Elegí entre {EDITORIAL_GALLERY_MIN_IMAGES} y {EDITORIAL_GALLERY_MAX_IMAGES} fotos.
            Se muestran como un slideshow en la nota publicada.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-semibold">Título (opcional)</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={140}
                className="mt-1 w-full rounded border border-[var(--is-border-strong)] px-3 py-2 text-sm"
                placeholder="Ej: La previa del partido"
              />
            </label>
            <label className="block text-sm">
              <span className="font-semibold">Texto general (opcional)</span>
              <input
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={300}
                className="mt-1 w-full rounded border border-[var(--is-border-strong)] px-3 py-2 text-sm"
                placeholder="Bajada breve de la galería"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-5 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoplay}
                onChange={(e) => setAutoplay(e.target.checked)}
              />
              Autoplay
            </label>
            <label className="flex items-center gap-2">
              Intervalo
              <input
                type="number"
                min={2000}
                max={15000}
                step={500}
                value={intervalMs}
                onChange={(e) => setIntervalMs(Number(e.target.value))}
                disabled={!autoplay}
                className="w-24 rounded border border-[var(--is-border-strong)] px-2 py-1 disabled:opacity-50"
              />
              ms
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
              Loop continuo
            </label>
          </div>

          <div className="mt-6 border-t border-[var(--is-border)] pt-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">
                Fotos seleccionadas · {images.length}/{EDITORIAL_GALLERY_MAX_IMAGES}
              </p>
              {missingAlt.length > 0 || missingCredit.length > 0 ? (
                <p className="text-xs font-medium text-amber-700">
                  {missingAlt.length > 0
                    ? `Falta alt en ${missingAlt.length}. `
                    : ""}
                  {missingCredit.length > 0 ? `Falta crédito en ${missingCredit.length}.` : ""}
                </p>
              ) : null}
            </div>

            {images.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--is-muted)]">
                Todavía no agregaste fotos. Usá las pestañas de abajo.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {images.map((img, index) => (
                  <li
                    key={img.id}
                    className="flex flex-wrap items-start gap-3 rounded-[var(--is-radius-sm)] border border-[var(--is-border)] p-3"
                  >
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded bg-[var(--is-bg-secondary)]">
                      {img.previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={img.previewUrl}
                          alt=""
                          className="h-full w-full object-cover"
                          draggable={false}
                        />
                      ) : (
                        <span className="text-[10px] text-[var(--is-muted)]">CLF</span>
                      )}
                    </div>
                    <div className="min-w-[220px] flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-[var(--is-bg-secondary)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--is-muted)]">
                          {img.source === "CLF" ? "ComprameLaFoto" : "Biblioteca propia"}
                        </span>
                        <span className="text-xs text-[var(--is-muted)]">
                          {index + 1} de {images.length}
                        </span>
                      </div>
                      <input
                        value={img.alt}
                        onChange={(e) => updateImage(img.id, { alt: e.target.value })}
                        placeholder="Texto alternativo *"
                        className="w-full rounded border border-[var(--is-border-strong)] px-2 py-1.5 text-sm"
                      />
                      <input
                        value={img.caption || ""}
                        onChange={(e) => updateImage(img.id, { caption: e.target.value })}
                        placeholder="Epígrafe (opcional)"
                        className="w-full rounded border border-[var(--is-border)] px-2 py-1.5 text-sm"
                      />
                      {img.source === "INFOSPOT" ? (
                        <input
                          value={img.credit || ""}
                          onChange={(e) => updateImage(img.id, { credit: e.target.value })}
                          placeholder="Crédito fotográfico *"
                          className="w-full rounded border border-[var(--is-border)] px-2 py-1.5 text-sm"
                        />
                      ) : (
                        <p className="text-xs text-[var(--is-muted)]">
                          Crédito y compra se toman automáticamente de ComprameLaFoto.
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => moveImage(img.id, -1)}
                        disabled={index === 0}
                        aria-label="Subir foto"
                        className="min-h-8 min-w-8 rounded border border-[var(--is-border-strong)] text-sm disabled:opacity-40"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveImage(img.id, 1)}
                        disabled={index === images.length - 1}
                        aria-label="Bajar foto"
                        className="min-h-8 min-w-8 rounded border border-[var(--is-border-strong)] text-sm disabled:opacity-40"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removeImage(img.id)}
                        aria-label="Quitar foto de la galería"
                        className="min-h-8 min-w-8 rounded border border-red-300 text-sm text-red-700"
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-6 border-t border-[var(--is-border)] pt-5">
            <div
              role="tablist"
              aria-label="Origen de las fotos"
              className="flex gap-2 border-b border-[var(--is-border)]"
            >
              <button
                type="button"
                role="tab"
                aria-selected={tab === "infospot"}
                onClick={() => setTab("infospot")}
                className={`min-h-10 border-b-2 px-3 text-sm font-medium ${
                  tab === "infospot"
                    ? "border-[var(--is-accent)] text-[var(--is-accent)]"
                    : "border-transparent text-[var(--is-muted)]"
                }`}
              >
                Biblioteca InfoSpot
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "clf"}
                onClick={() => setTab("clf")}
                className={`min-h-10 border-b-2 px-3 text-sm font-medium ${
                  tab === "clf"
                    ? "border-[var(--is-accent)] text-[var(--is-accent)]"
                    : "border-transparent text-[var(--is-muted)]"
                }`}
              >
                Álbum CLF vinculado
              </button>
            </div>

            <div className="pt-4">
              {tab === "infospot" ? (
                <div>
                  <label className="text-sm font-semibold">Subir fotos *</label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="mt-2 block w-full text-sm"
                    onChange={(e) => void handleFiles(e.target.files)}
                    disabled={uploading}
                  />
                  {uploading ? (
                    <p className="mt-2 text-xs text-[var(--is-muted)]">Subiendo…</p>
                  ) : null}
                </div>
              ) : clfAlbumId ? (
                <ClfEditorialPhotoSelector
                  albumId={clfAlbumId}
                  articleId={articleId ?? undefined}
                  coverageId={coverageId ?? undefined}
                  multiple
                  selectedPhotoIds={selectedClfPhotoIds}
                  onToggle={handleClfToggle}
                />
              ) : (
                <p className="text-sm text-[var(--is-muted)]">
                  Esta nota no tiene un álbum de ComprameLaFoto vinculado. Vinculá una cobertura
                  desde Redacción → Coberturas para elegir fotos de ahí.
                </p>
              )}
            </div>
          </div>

          {error ? (
            <p className="mt-4 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--is-border)] px-6 py-4">
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] px-4 text-sm font-medium"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--is-accent-hover)] disabled:opacity-60"
            onClick={submit}
            disabled={!canSubmit}
          >
            {isEdit ? "Guardar cambios" : `Insertar galería (${images.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}
