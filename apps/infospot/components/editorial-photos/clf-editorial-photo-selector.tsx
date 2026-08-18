"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { selectEditorialPhotoAction } from "@/app/actions/editorial-photos";
import { EditorialPhotoThumbnail } from "@/components/editorial-photos/editorial-photo-thumbnail";
import { toEditorialPhotoPreview } from "@/lib/editorial-photo-previews";

type PhotoHit = {
  id: number;
  photographerName: string;
  thumbApiPath: string;
  editorialPhotoId: string | null;
  processStatus: string | null;
};

type Props = {
  albumId: number;
  articleId?: string;
  coverageId?: string;
  defaultUsage?: "COVER" | "INLINE" | "GALLERY" | "FEATURED";
  onSelected?: (result: {
    photoId: string;
    deliverySrc: string | null;
    usageType: string;
  }) => void;
  /**
   * Modo galería: selección múltiple por click (toggle), sin exigir alt
   * text previo — el alt de cada foto se completa después en la lista de
   * trabajo del bloque de galería. Oculta el selector de "Uso" (siempre
   * INLINE, igual que una imagen suelta del cuerpo).
   */
  multiple?: boolean;
  /** ids CLF ya agregados a la galería en curso — se muestran marcados. */
  selectedPhotoIds?: Set<number>;
  onToggle?: (input: {
    clfPhotoId: number;
    photoId: string;
    deliverySrc: string | null;
    photographerName: string;
    usageId: string | null;
    selected: boolean;
  }) => void;
};

/**
 * Selector: «Agregar fotos desde ComprameLaFoto».
 * Paginado; no expone original ni storage keys.
 */
export function ClfEditorialPhotoSelector({
  albumId,
  articleId,
  coverageId,
  defaultUsage = "INLINE",
  onSelected,
  multiple = false,
  selectedPhotoIds,
  onToggle,
}: Props) {
  const [photos, setPhotos] = useState<PhotoHit[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [usage, setUsage] = useState(defaultUsage);
  const [altText, setAltText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [albumTitle, setAlbumTitle] = useState<string>("");
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (reset = false) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          albumId: String(albumId),
          take: "24",
        });
        if (!reset && cursor) params.set("cursor", String(cursor));
        const res = await fetch(`/api/redaccion/editorial-photos?${params}`, {
          credentials: "include",
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error || `Error ${res.status}`);
        }
        const data = (await res.json()) as {
          album: { title: string };
          photos: PhotoHit[];
          nextCursor: number | null;
          hasMore: boolean;
        };
        setAlbumTitle(data.album.title);
        setPhotos((prev) => (reset ? data.photos : [...prev, ...data.photos]));
        setCursor(data.nextCursor);
        setHasMore(data.hasMore);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudieron cargar fotos");
      } finally {
        setLoading(false);
      }
    },
    [albumId, cursor],
  );

  useEffect(() => {
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carga inicial por álbum
  }, [albumId]);

  const select = (photoId: number, photographerName: string) => {
    if (multiple && selectedPhotoIds?.has(photoId)) {
      // Deselección: la lista de trabajo del diálogo decide si limpia el
      // usage en servidor o lo deja (idempotente, sin costo de mostrarlo).
      onToggle?.({
        clfPhotoId: photoId,
        photoId: "",
        deliverySrc: null,
        photographerName,
        usageId: null,
        selected: false,
      });
      return;
    }

    startTransition(async () => {
      setError(null);
      const trimmedAlt = altText.trim();
      if (!multiple && !trimmedAlt) {
        setError("Completá la descripción (alt text) antes de seleccionar la foto.");
        return;
      }
      const result = await selectEditorialPhotoAction({
        clfPhotoId: photoId,
        articleId,
        coverageId,
        usageType: multiple ? "INLINE" : usage,
        altText: trimmedAlt || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (multiple) {
        onToggle?.({
          clfPhotoId: photoId,
          photoId: result.photoId,
          deliverySrc: result.deliverySrc,
          photographerName,
          usageId: result.usageId,
          selected: true,
        });
        return;
      }
      onSelected?.({
        photoId: result.photoId,
        deliverySrc: result.deliverySrc,
        usageType: usage,
      });
    });
  };

  return (
    <div className="space-y-4 rounded-[var(--is-radius)] border border-[var(--is-border)] bg-white p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--is-accent)]">
            Agregar fotos desde ComprameLaFoto
          </p>
          <p className="mt-1 text-sm text-[var(--is-muted)]">
            {albumTitle || "Cobertura fotográfica"} · vistas previas editoriales
          </p>
        </div>
        {!multiple ? (
          <label className="text-sm">
            Uso{" "}
            <select
              className="ml-2 rounded border border-[var(--is-border)] px-2 py-1"
              value={usage}
              onChange={(e) => setUsage(e.target.value as typeof usage)}
            >
              <option value="COVER">Portada</option>
              <option value="INLINE">Cuerpo</option>
              <option value="GALLERY">Galería</option>
              <option value="FEATURED">Destacada</option>
            </select>
          </label>
        ) : null}
      </div>

      {!multiple ? (
        <label className="block text-sm">
          <span className="font-semibold">Descripción (alt text) *</span>
          <textarea
            value={altText}
            onChange={(e) => setAltText(e.target.value)}
            rows={2}
            maxLength={300}
            placeholder="Describí la foto que vas a seleccionar"
            className="mt-1 w-full rounded border border-[var(--is-border)] px-3 py-2 text-sm"
          />
          <span className="mt-1 block text-xs text-[var(--is-muted)]">
            Se aplica a la próxima foto que selecciones. Obligatorio para publicar.
          </span>
        </label>
      ) : (
        <p className="text-xs text-[var(--is-muted)]">
          Elegí las fotos tocándolas. El texto alternativo de cada una se completa en la lista de
          abajo antes de insertar la galería.
        </p>
      )}

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {photos.map((p) => {
          const preview = toEditorialPhotoPreview({
            photoId: p.id,
            albumId,
            photographerName: p.photographerName,
            albumName: albumTitle,
          });
          if (p.thumbApiPath) preview.previewUrl = p.thumbApiPath;
          const isSelected = multiple && (selectedPhotoIds?.has(p.id) ?? false);
          return (
            <li key={p.id}>
              <EditorialPhotoThumbnail
                preview={preview}
                selectable
                selected={isSelected}
                selectLabel={
                  pending ? "Procesando…" : isSelected ? "Agregada ✓ (quitar)" : "Agregar"
                }
                onSelect={() => select(p.id, p.photographerName)}
              />
            </li>
          );
        })}
      </ul>

      {hasMore ? (
        <button
          type="button"
          disabled={loading}
          onClick={() => void load(false)}
          className="min-h-11 rounded border border-[var(--is-border)] px-4 text-sm"
        >
          {loading ? "Cargando…" : "Cargar más"}
        </button>
      ) : null}
    </div>
  );
}
