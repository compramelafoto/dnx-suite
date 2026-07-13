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
}: Props) {
  const [photos, setPhotos] = useState<PhotoHit[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [usage, setUsage] = useState(defaultUsage);
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

  const select = (photoId: number) => {
    startTransition(async () => {
      setError(null);
      const result = await selectEditorialPhotoAction({
        clfPhotoId: photoId,
        articleId,
        coverageId,
        usageType: usage,
      });
      if (!result.ok) {
        setError(result.error);
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
      </div>

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
          return (
            <li key={p.id}>
              <EditorialPhotoThumbnail
                preview={preview}
                selectable
                selectLabel={pending ? "Procesando…" : "Seleccionar"}
                onSelect={() => select(p.id)}
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
