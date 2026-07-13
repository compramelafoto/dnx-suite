"use client";

import { useEffect, useId, useState, useTransition } from "react";
import type { EditorialImageAttrs } from "@repo/editor";
import { importClfPhotosAction } from "@/app/actions/clf-link";
import { formatDateEs } from "@/lib/dates";
import { EditorialPhotoThumbnail } from "@/components/editorial-photos/editorial-photo-thumbnail";
import { toEditorialPhotoPreview } from "@/lib/editorial-photo-previews";

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

type Props = {
  open: boolean;
  onClose: () => void;
  articleId: string;
  onInsertInline: (attrs: EditorialImageAttrs) => void;
  onCoverImported?: () => void;
};

const statusLabel = {
  AVAILABLE: "Disponible para compra",
  REACTIVATABLE: "Reactivable (sin compra directa)",
  UNAVAILABLE: "No disponible comercialmente",
} as const;

export function ClfPhotoPickerDialog({
  open,
  onClose,
  articleId,
  onInsertInline,
  onCoverImported,
}: Props) {
  const titleId = useId();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [events, setEvents] = useState<EventHit[]>([]);
  const [eventId, setEventId] = useState<number | null>(null);
  const [eventTitle, setEventTitle] = useState("");
  const [albums, setAlbums] = useState<AlbumHit[]>([]);
  const [album, setAlbum] = useState<AlbumHit | null>(null);
  const [photos, setPhotos] = useState<PhotoHit[]>([]);
  const [selectedPhotoId, setSelectedPhotoId] = useState<number | null>(null);
  const [usage, setUsage] = useState<"COVER" | "INLINE">("INLINE");
  const [alt, setAlt] = useState("");
  const [caption, setCaption] = useState("");
  const [credit, setCredit] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!selectedPhotoId) return;
    const photo = photos.find((p) => p.id === selectedPhotoId);
    if (!photo) return;
    setCredit((prev) =>
      prev.trim() ? prev : photo.photographerName ? `Foto: ${photo.photographerName}` : "",
    );
  }, [selectedPhotoId, photos]);

  if (!open) return null;

  async function searchEvents() {
    setError(null);
    const res = await fetch(
      `/api/redaccion/clf-events?q=${encodeURIComponent(query.trim())}`,
    );
    const data = (await res.json()) as { events?: EventHit[]; error?: string };
    if (!res.ok) {
      setError(data.error || "No se pudieron buscar eventos");
      return;
    }
    setEvents(data.events ?? []);
  }

  async function selectEvent(ev: EventHit) {
    setError(null);
    setEventId(ev.id);
    setEventTitle(ev.title);
    setAlbum(null);
    setPhotos([]);
    setSelectedPhotoId(null);
    const res = await fetch(`/api/redaccion/clf-events/${ev.id}/albums`);
    const data = (await res.json()) as { albums?: AlbumHit[]; error?: string };
    if (!res.ok) {
      setError(data.error || "No se pudieron cargar álbumes");
      return;
    }
    setAlbums(data.albums ?? []);
  }

  async function selectAlbum(next: AlbumHit) {
    setError(null);
    setAlbum(next);
    setSelectedPhotoId(null);
    const res = await fetch(`/api/redaccion/clf-albums/${next.id}/photos`);
    const data = (await res.json()) as { photos?: PhotoHit[]; error?: string };
    if (!res.ok) {
      setError(data.error || "No se pudieron cargar fotografías");
      return;
    }
    setPhotos(data.photos ?? []);
  }

  function confirmImport() {
    setError(null);
    setMessage(null);
    if (!album || !selectedPhotoId) {
      setError("Elegí un evento, un álbum y una fotografía.");
      return;
    }
    if (!alt.trim()) {
      setError("El texto alternativo (alt) es obligatorio.");
      return;
    }
    if (!credit.trim()) {
      setError("El crédito fotográfico es obligatorio.");
      return;
    }

    startTransition(async () => {
      const result = await importClfPhotosAction({
        articleId,
        albumId: album.id,
        photoIds: [selectedPhotoId],
        usageType: usage,
        captions: caption.trim() ? { [selectedPhotoId]: caption.trim() } : undefined,
        autoLinkAlbum: true,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const asset = result.assets?.[0];
      if (!asset) {
        setError("Importación sin asset retornado");
        return;
      }
      if (usage === "INLINE") {
        onInsertInline({
          src: asset.url,
          alt: alt.trim(),
          caption: caption.trim() || asset.caption || "",
          credit: credit.trim() || asset.credit || "",
          assetId: asset.id,
        });
      } else {
        setMessage(result.message);
        onCoverImported?.();
      }
      onClose();
    });
  }

  const selected = photos.find((p) => p.id === selectedPhotoId) ?? null;

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
      <div className="flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-white shadow-sm">
        <div className="border-b border-[var(--is-border)] px-5 py-4 sm:px-6">
          <h2
            id={titleId}
            className="font-[family-name:var(--font-source-serif)] text-xl font-semibold"
          >
            Elegir desde ComprameLaFoto
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--is-muted)]">
            Solo lectura sobre CLF. Se crea una copia editorial permanente en Info Spot (no el
            original).
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1 space-y-2 text-sm">
              <span className="font-semibold">1. Evento</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="min-h-11 w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] px-3 text-sm"
                placeholder="Buscar por título o ciudad"
              />
            </label>
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] px-4 text-sm font-medium"
              onClick={() => void searchEvents()}
            >
              Buscar
            </button>
          </div>

          {events.length > 0 ? (
            <ul className="space-y-2">
              {events.slice(0, 8).map((ev) => (
                <li key={ev.id}>
                  <button
                    type="button"
                    onClick={() => void selectEvent(ev)}
                    className={`w-full rounded-[var(--is-radius-sm)] border px-3 py-3 text-left text-sm ${
                      eventId === ev.id
                        ? "border-[var(--is-accent)] bg-[var(--is-accent-soft)]"
                        : "border-[var(--is-border)] hover:border-[var(--is-border-strong)]"
                    }`}
                  >
                    <span className="font-semibold">{ev.title}</span>
                    <span className="mt-1 block text-xs text-[var(--is-muted)]">
                      {formatDateEs(ev.startsAt)} · {ev.city}
                      {ev.locationName ? ` · ${ev.locationName}` : ""} · {ev.albumCount} álbum
                      {ev.albumCount === 1 ? "" : "es"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {eventId ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold">2. Álbum — {eventTitle}</p>
              <ul className="space-y-2">
                {albums.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => void selectAlbum(item)}
                      className={`w-full rounded-[var(--is-radius-sm)] border px-3 py-3 text-left text-sm ${
                        album?.id === item.id
                          ? "border-[var(--is-accent)] bg-[var(--is-accent-soft)]"
                          : "border-[var(--is-border)] hover:border-[var(--is-border-strong)]"
                      }`}
                    >
                      <span className="font-semibold">{item.title}</span>
                      <span className="mt-1 block text-xs text-[var(--is-muted)]">
                        {item.photographerName} · {item.photoCount} fotos ·{" "}
                        {statusLabel[item.availability.status]}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {album ? (
                <p
                  className={`rounded-[var(--is-radius-sm)] px-3 py-2 text-xs ${
                    album.availability.status === "AVAILABLE"
                      ? "bg-emerald-50 text-emerald-900"
                      : album.availability.status === "REACTIVATABLE"
                        ? "bg-amber-50 text-amber-950"
                        : "bg-stone-100 text-stone-700"
                  }`}
                >
                  Estado comercial: {statusLabel[album.availability.status]}. La disponibilidad no
                  impide el uso editorial si hay copia permanente autorizada.
                </p>
              ) : null}
            </div>
          ) : null}

          {album ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold">3. Fotografías disponibles</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photos.map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => setSelectedPhotoId(photo.id)}
                    className={`overflow-hidden rounded-[var(--is-radius-sm)] border text-left ${
                      selectedPhotoId === photo.id
                        ? "border-[var(--is-accent)] ring-2 ring-[var(--is-accent)]/30"
                        : "border-[var(--is-border)]"
                    }`}
                  >
                    <EditorialPhotoThumbnail
                      preview={{
                        ...toEditorialPhotoPreview({
                          photoId: photo.id,
                          albumId: album!.id,
                          photographerName: photo.photographerName,
                        }),
                        previewUrl: photo.thumbApiPath,
                      }}
                      showPhotographer={false}
                      className="pointer-events-none"
                    />
                    <span className="block px-2 py-2 text-[11px] text-[var(--is-muted)]">
                      {photo.photographerName}
                      {photo.hasEditorialCopy ? " · copia editorial" : ""}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {selected ? (
            <div className="space-y-4 border-t border-[var(--is-border)] pt-5">
              <p className="text-sm font-semibold">4. Uso y créditos</p>
              <div className="flex flex-wrap gap-3">
                <label className="inline-flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="clf-usage"
                    checked={usage === "INLINE"}
                    onChange={() => setUsage("INLINE")}
                  />
                  Insertar en el cuerpo
                </label>
                <label className="inline-flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="clf-usage"
                    checked={usage === "COVER"}
                    onChange={() => setUsage("COVER")}
                  />
                  Usar como portada
                </label>
              </div>
              <label className="block space-y-2 text-sm">
                <span className="font-semibold">Texto alternativo (alt) *</span>
                <input
                  value={alt}
                  onChange={(e) => setAlt(e.target.value)}
                  className="min-h-11 w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] px-3"
                  placeholder="Descripción breve de lo que se ve"
                />
              </label>
              <label className="block space-y-2 text-sm">
                <span className="font-semibold">Epígrafe</span>
                <input
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="min-h-11 w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] px-3"
                />
              </label>
              <label className="block space-y-2 text-sm">
                <span className="font-semibold">Crédito fotográfico *</span>
                <input
                  value={credit}
                  onChange={(e) => setCredit(e.target.value)}
                  className="min-h-11 w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] px-3"
                />
              </label>
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-800">{message}</p> : null}
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--is-border)] px-5 py-4 sm:px-6">
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] px-4 text-sm font-medium"
            onClick={onClose}
            disabled={pending}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--is-accent-hover)] disabled:opacity-60"
            onClick={confirmImport}
            disabled={pending || !selectedPhotoId}
          >
            {pending ? "Importando…" : usage === "COVER" ? "Usar como portada" : "Insertar en la nota"}
          </button>
        </div>
      </div>
    </div>
  );
}
