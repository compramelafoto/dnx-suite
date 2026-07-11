"use client";

import { useCallback, useState, useTransition } from "react";
import {
  importClfPhotosAction,
  linkClfAlbumAction,
  linkClfEventAction,
  removeArticleAssetLinkAction,
} from "@/app/actions/clf-link";
import { formatDateEs } from "@/lib/dates";

type EventHit = {
  id: number;
  title: string;
  startsAt: string;
  city: string;
  locationName: string | null;
  status: string;
  organizerName: string;
  albumCount: number;
};

type AlbumHit = {
  id: number;
  title: string;
  photographerName: string;
  photographerId: number;
  photoCount: number;
  availability: {
    status: "AVAILABLE" | "REACTIVATABLE" | "UNAVAILABLE";
    reason: string;
    publicUrl: string;
  };
};

type PhotoHit = {
  id: number;
  photographerName: string;
  photographerId: number;
  albumTitle: string;
  eventTitle: string | null;
  hasEditorialCopy: boolean;
  thumbApiPath: string;
};

type LinkedAsset = {
  linkId: string;
  usageType: "COVER" | "INLINE" | "GALLERY";
  sortOrder: number;
  captionOverride: string | null;
  url: string;
  thumbnailUrl: string | null;
  credit: string | null;
  photographerName: string | null;
};

type Props = {
  articleId: string;
  initialEventId: number | null;
  initialAlbumId: number | null;
  initialEventTitle?: string | null;
  initialAlbumTitle?: string | null;
  linkedAssets: LinkedAsset[];
};

const statusLabel = {
  AVAILABLE: "Álbum disponible para compra",
  REACTIVATABLE: "Álbum dentro del período de reactivación",
  UNAVAILABLE: "Álbum no disponible comercialmente",
} as const;

export function ClfEventPicker({
  articleId,
  initialEventId,
  initialAlbumId,
  initialEventTitle,
  initialAlbumTitle,
  linkedAssets,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [events, setEvents] = useState<EventHit[]>([]);
  const [eventId, setEventId] = useState<number | null>(initialEventId);
  const [eventTitle, setEventTitle] = useState(initialEventTitle ?? "");
  const [albums, setAlbums] = useState<AlbumHit[]>([]);
  const [albumId, setAlbumId] = useState<number | null>(initialAlbumId);
  const [albumTitle, setAlbumTitle] = useState(initialAlbumTitle ?? "");
  const [albumStatus, setAlbumStatus] = useState<AlbumHit["availability"]["status"] | null>(null);
  const [photos, setPhotos] = useState<PhotoHit[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [usage, setUsage] = useState<"COVER" | "INLINE" | "GALLERY">("GALLERY");
  const [captions, setCaptions] = useState<Record<number, string>>({});
  const [photographerFilter, setPhotographerFilter] = useState<number | "ALL">("ALL");

  const flash = useCallback((ok: string | null, err: string | null) => {
    setMessage(ok);
    setError(err);
  }, []);

  async function searchEvents() {
    flash(null, null);
    const res = await fetch(`/api/redaccion/clf-events?q=${encodeURIComponent(query)}`);
    const data = (await res.json()) as { events?: EventHit[]; error?: string };
    if (!res.ok) {
      flash(null, data.error || "Error al buscar");
      return;
    }
    setEvents(data.events ?? []);
  }

  async function selectEvent(ev: EventHit) {
    flash(null, null);
    startTransition(async () => {
      const result = await linkClfEventAction(articleId, ev.id);
      if (!result.ok) {
        flash(null, result.error);
        return;
      }
      setEventId(ev.id);
      setEventTitle(ev.title);
      setAlbumId(null);
      setAlbumTitle("");
      setPhotos([]);
      setSelected([]);
      const res = await fetch(`/api/redaccion/clf-events/${ev.id}/albums`);
      const data = (await res.json()) as { albums?: AlbumHit[]; error?: string };
      if (!res.ok) {
        flash(null, data.error || "Error al listar álbumes");
        return;
      }
      setAlbums(data.albums ?? []);
      flash(result.message, null);
    });
  }

  async function unlinkEvent() {
    startTransition(async () => {
      const result = await linkClfEventAction(articleId, null);
      if (!result.ok) {
        flash(null, result.error);
        return;
      }
      setEventId(null);
      setEventTitle("");
      setAlbums([]);
      setAlbumId(null);
      setAlbumTitle("");
      setPhotos([]);
      flash(result.message, null);
    });
  }

  async function selectAlbum(album: AlbumHit) {
    startTransition(async () => {
      const result = await linkClfAlbumAction(articleId, album.id);
      if (!result.ok) {
        flash(null, result.error);
        return;
      }
      setAlbumId(album.id);
      setAlbumTitle(album.title);
      setAlbumStatus(album.availability.status);
      const res = await fetch(`/api/redaccion/clf-albums/${album.id}/photos`);
      const data = (await res.json()) as { photos?: PhotoHit[]; error?: string };
      if (!res.ok) {
        flash(null, data.error || "Error al listar fotos");
        return;
      }
      setPhotos(data.photos ?? []);
      setSelected([]);
      flash(result.message, null);
    });
  }

  async function unlinkAlbum() {
    startTransition(async () => {
      const result = await linkClfAlbumAction(articleId, null);
      if (!result.ok) {
        flash(null, result.error);
        return;
      }
      setAlbumId(null);
      setAlbumTitle("");
      setAlbumStatus(null);
      setPhotos([]);
      flash(result.message, null);
    });
  }

  function togglePhoto(id: number) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function importSelected() {
    if (!albumId) return;
    startTransition(async () => {
      const result = await importClfPhotosAction({
        articleId,
        albumId,
        photoIds: selected,
        usageType: usage,
        captions,
      });
      if (!result.ok) {
        flash(null, result.error);
        return;
      }
      flash(
        `${result.message}. Esta fotografía quedará preservada como copia editorial permanente.`,
        null,
      );
      setSelected([]);
    });
  }

  const photographers = Array.from(
    new Map(photos.map((p) => [p.photographerId, p.photographerName])).entries(),
  );
  const visiblePhotos =
    photographerFilter === "ALL"
      ? photos
      : photos.filter((p) => p.photographerId === photographerFilter);

  return (
    <section className="space-y-6 rounded-[var(--is-radius)] border border-[var(--is-border)] bg-[var(--is-surface)] p-5">
      <div>
        <h2 className="text-lg font-semibold">Evento y fotografías de ComprameLaFoto</h2>
        <p className="mt-1 text-sm text-[var(--is-muted)]">
          Buscá un evento, elegí un álbum e importá fotos como copia editorial permanente (no depende
          de la vigencia comercial del álbum).
        </p>
      </div>

      {message ? <p className="text-sm text-teal-800">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--is-muted)]">
          3. Evento CLF
        </h3>
        {eventId ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--is-radius-sm)] border border-[var(--is-border)] px-3 py-3">
            <div>
              <p className="font-medium">{eventTitle || `Evento #${eventId}`}</p>
              <p className="text-xs text-[var(--is-muted)]">ID {eventId}</p>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() => void unlinkEvent()}
              className="min-h-11 text-sm text-red-700"
            >
              Desvincular evento
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre, organizador, ciudad…"
              className="min-h-11 flex-1 rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] px-3"
            />
            <button
              type="button"
              disabled={pending || query.trim().length < 2}
              onClick={() => void searchEvents()}
              className="min-h-11 rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              Buscar
            </button>
          </div>
        )}

        {events.length > 0 && !eventId ? (
          <ul className="divide-y divide-[var(--is-border)] rounded-[var(--is-radius-sm)] border border-[var(--is-border)]">
            {events.map((ev) => (
              <li key={ev.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-3">
                <div>
                  <p className="font-medium">{ev.title}</p>
                  <p className="text-xs text-[var(--is-muted)]">
                    {formatDateEs(ev.startsAt)} · {ev.city}
                    {ev.locationName ? ` · ${ev.locationName}` : ""} · {ev.organizerName} ·{" "}
                    {ev.albumCount} álbum(es) · {ev.status}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void selectEvent(ev)}
                  className="min-h-11 text-sm font-medium text-[var(--is-accent)]"
                >
                  Seleccionar
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--is-muted)]">
          4. Álbum comercial
        </h3>
        {albumId ? (
          <div className="rounded-[var(--is-radius-sm)] border border-[var(--is-border)] px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">{albumTitle || `Álbum #${albumId}`}</p>
                {albumStatus ? (
                  <p className="mt-1 text-sm text-[var(--is-text-secondary)]">
                    {statusLabel[albumStatus]}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => void unlinkAlbum()}
                className="min-h-11 text-sm text-red-700"
              >
                Desvincular álbum
              </button>
            </div>
          </div>
        ) : null}

        {albums.length > 0 ? (
          <ul className="space-y-2">
            {albums.map((album) => (
              <li
                key={album.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--is-radius-sm)] border border-[var(--is-border)] px-3 py-3"
              >
                <div>
                  <p className="font-medium">{album.title}</p>
                  <p className="text-xs text-[var(--is-muted)]">
                    {album.photographerName} · {album.photoCount} fotos ·{" "}
                    {statusLabel[album.availability.status]}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void selectAlbum(album)}
                  className="min-h-11 text-sm font-medium text-[var(--is-accent)]"
                >
                  Usar álbum
                </button>
              </li>
            ))}
          </ul>
        ) : eventId ? (
          <p className="text-sm text-[var(--is-muted)]">No hay álbumes para este evento.</p>
        ) : null}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--is-muted)]">
          5. Fotografías editoriales
        </h3>

        {linkedAssets.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Ya vinculadas a esta noticia</p>
            <ul className="grid gap-3 sm:grid-cols-2">
              {linkedAssets.map((asset) => (
                <li
                  key={asset.linkId}
                  className="overflow-hidden rounded-[var(--is-radius-sm)] border border-[var(--is-border)]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={asset.thumbnailUrl || asset.url}
                    alt=""
                    className="aspect-video w-full object-cover"
                    draggable={false}
                  />
                  <div className="space-y-1 p-3 text-xs text-[var(--is-muted)]">
                    <p className="font-semibold text-[var(--is-text)]">{asset.usageType}</p>
                    <p>{asset.credit}</p>
                    <button
                      type="button"
                      disabled={pending}
                      className="min-h-11 text-red-700"
                      onClick={() =>
                        startTransition(async () => {
                          const result = await removeArticleAssetLinkAction(articleId, asset.linkId);
                          flash(result.ok ? result.message : null, result.ok ? null : result.error);
                        })
                      }
                    >
                      Quitar de la noticia
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {photos.length > 0 ? (
          <>
            <div className="flex flex-wrap gap-3">
              <select
                value={photographerFilter === "ALL" ? "ALL" : String(photographerFilter)}
                onChange={(e) =>
                  setPhotographerFilter(
                    e.target.value === "ALL" ? "ALL" : Number(e.target.value),
                  )
                }
                className="min-h-11 rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] px-3 text-sm"
              >
                <option value="ALL">Todos los fotógrafos</option>
                {photographers.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
              <select
                value={usage}
                onChange={(e) => setUsage(e.target.value as typeof usage)}
                className="min-h-11 rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] px-3 text-sm"
              >
                <option value="COVER">Usar como portada</option>
                <option value="INLINE">Imágenes internas (INLINE)</option>
                <option value="GALLERY">Galería</option>
              </select>
              <button
                type="button"
                disabled={pending || selected.length === 0}
                onClick={() => void importSelected()}
                className="min-h-11 rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                Importar seleccionadas ({selected.length})
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {visiblePhotos.map((photo) => {
                const isOn = selected.includes(photo.id);
                return (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => togglePhoto(photo.id)}
                    className={`overflow-hidden rounded-[var(--is-radius-sm)] border text-left ${
                      isOn
                        ? "border-[var(--is-accent)] ring-2 ring-[var(--is-accent)]/30"
                        : "border-[var(--is-border)]"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.thumbApiPath}
                      alt=""
                      className="aspect-square w-full object-cover"
                      draggable={false}
                    />
                    <div className="space-y-1 p-2 text-[10px] leading-snug text-[var(--is-muted)]">
                      <p className="font-semibold text-[var(--is-text)]">{photo.photographerName}</p>
                      <p>{photo.albumTitle}</p>
                      {photo.eventTitle ? <p>{photo.eventTitle}</p> : null}
                      {photo.hasEditorialCopy ? (
                        <p className="text-teal-700">Ya tiene copia editorial</p>
                      ) : null}
                    </div>
                    {isOn ? (
                      <div className="border-t border-[var(--is-border)] p-2">
                        <input
                          value={captions[photo.id] ?? ""}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            setCaptions((prev) => ({ ...prev, [photo.id]: e.target.value }))
                          }
                          placeholder="Epígrafe"
                          className="w-full rounded border border-[var(--is-border)] px-2 py-1 text-xs"
                        />
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </>
        ) : albumId ? (
          <p className="text-sm text-[var(--is-muted)]">Este álbum no tiene fotos importables.</p>
        ) : null}
      </div>
    </section>
  );
}
