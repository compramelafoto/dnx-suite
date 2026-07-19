"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  importClfPhotosAction,
  linkClfAlbumAction,
  linkClfEventAction,
  removeArticleAssetLinkAction,
} from "@/app/actions/clf-link";
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

type UsageType = "COVER" | "INLINE" | "GALLERY";

const statusLabel = {
  AVAILABLE: "Disponible para compra en ComprameLaFoto",
  REACTIVATABLE: "Dentro del período de reactivación",
  UNAVAILABLE: "Sin venta comercial (igual se puede importar)",
} as const;

const USAGE_OPTIONS: {
  value: UsageType;
  label: string;
  hint: string;
}[] = [
  {
    value: "COVER",
    label: "Portada",
    hint: "Imagen principal de la nota (thumbnail / hero). Una sola.",
  },
  {
    value: "INLINE",
    label: "Cuerpo de la nota",
    hint: "Fotos que van dentro del texto (con crédito y epígrafe).",
  },
  {
    value: "GALLERY",
    label: "Galería",
    hint: "Colección al final o lateral; no se insertan en el párrafo.",
  },
];

const USAGE_BADGE: Record<UsageType, string> = {
  COVER: "Portada",
  INLINE: "Cuerpo",
  GALLERY: "Galería",
};

export function ClfEventPicker({
  articleId,
  initialEventId,
  initialAlbumId,
  initialEventTitle,
  initialAlbumTitle,
  linkedAssets,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [events, setEvents] = useState<EventHit[]>([]);
  const [eventId, setEventId] = useState<number | null>(initialEventId);
  const [eventTitle, setEventTitle] = useState(initialEventTitle ?? "");
  const [albums, setAlbums] = useState<AlbumHit[]>([]);
  const [albumsLoading, setAlbumsLoading] = useState(false);
  const [albumId, setAlbumId] = useState<number | null>(initialAlbumId);
  const [albumTitle, setAlbumTitle] = useState(initialAlbumTitle ?? "");
  const [albumStatus, setAlbumStatus] = useState<AlbumHit["availability"]["status"] | null>(null);
  const [photos, setPhotos] = useState<PhotoHit[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [usage, setUsage] = useState<UsageType>("COVER");
  const [captions, setCaptions] = useState<Record<number, string>>({});
  const [altTexts, setAltTexts] = useState<Record<number, string>>({});
  const [photographerFilter, setPhotographerFilter] = useState<number | "ALL">("ALL");
  const [hydrated, setHydrated] = useState(false);
  const [uploading, setUploading] = useState(false);

  const flash = useCallback((ok: string | null, err: string | null) => {
    setMessage(ok);
    setError(err);
  }, []);

  const loadAlbums = useCallback(async (evId: number) => {
    setAlbumsLoading(true);
    try {
      const res = await fetch(`/api/redaccion/clf-events/${evId}/albums`);
      const data = (await res.json()) as { albums?: AlbumHit[]; error?: string };
      if (!res.ok) {
        flash(null, data.error || "Error al listar coberturas");
        setAlbums([]);
        return;
      }
      const list = data.albums ?? [];
      setAlbums(list);
      return list;
    } finally {
      setAlbumsLoading(false);
    }
  }, [flash]);

  const loadPhotos = useCallback(async (albId: number) => {
    setPhotosLoading(true);
    try {
      const res = await fetch(`/api/redaccion/clf-albums/${albId}/photos`);
      const data = (await res.json()) as { photos?: PhotoHit[]; error?: string };
      if (!res.ok) {
        flash(null, data.error || "Error al listar fotos de la cobertura");
        setPhotos([]);
        return;
      }
      setPhotos(data.photos ?? []);
      setSelected([]);
    } finally {
      setPhotosLoading(false);
    }
  }, [flash]);

  // Rehidratar álbumes y fotos al abrir una nota ya vinculada.
  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      if (cancelled) return;
      if (initialEventId) {
        const list = await loadAlbums(initialEventId);
        if (cancelled) return;
        if (initialAlbumId && list) {
          const hit = list.find((a) => a.id === initialAlbumId);
          if (hit) {
            setAlbumTitle(hit.title);
            setAlbumStatus(hit.availability.status);
          }
        }
      }
      if (initialAlbumId) {
        await loadPhotos(initialAlbumId);
      }
      if (!cancelled) setHydrated(true);
    }
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [initialEventId, initialAlbumId, loadAlbums, loadPhotos]);

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
      setAlbumStatus(null);
      setPhotos([]);
      setSelected([]);
      await loadAlbums(ev.id);
      flash(result.message, null);
      router.refresh();
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
      setAlbumStatus(null);
      setPhotos([]);
      flash(result.message, null);
      router.refresh();
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
      await loadPhotos(album.id);
      flash(result.message, null);
      router.refresh();
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
      router.refresh();
    });
  }

  function togglePhoto(id: number) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function importSelected() {
    if (!albumId || selected.length === 0) return;
    if (usage === "COVER" && selected.length > 1) {
      flash(null, "Para portada elegí una sola foto.");
      return;
    }
    startTransition(async () => {
      const result = await importClfPhotosAction({
        articleId,
        albumId,
        photoIds: selected,
        usageType: usage,
        captions,
        altTexts,
      });
      if (!result.ok) {
        flash(null, result.error);
        return;
      }
      flash(
        `${result.message}. Copia editorial permanente guardada en Info Spot.`,
        null,
      );
      setSelected([]);
      await loadPhotos(albumId);
      router.refresh();
    });
  }

  async function uploadLocal(file: File | null, purpose: "cover" | "inline") {
    if (!file) return;
    setUploading(true);
    flash(null, null);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("purpose", purpose);
      body.set("articleId", articleId);
      body.set("alt", purpose === "cover" ? "Portada" : "Imagen editorial");
      body.set("credit", "Redacción Info Spot");
      const res = await fetch("/api/redaccion/upload", { method: "POST", body });
      const data = (await res.json()) as { error?: string; asset?: { id: string } };
      if (!res.ok) throw new Error(data.error || "No se pudo subir la imagen");
      flash(
        purpose === "cover"
          ? "Portada subida. Revisá el crédito en el panel lateral."
          : "Imagen subida al cuerpo. También podés insertarla desde la barra del editor.",
        null,
      );
      router.refresh();
    } catch (e) {
      flash(null, e instanceof Error ? e.message : "Error de subida");
    } finally {
      setUploading(false);
    }
  }

  const photographers = Array.from(
    new Map(photos.map((p) => [p.photographerId, p.photographerName])).entries(),
  );
  const visiblePhotos =
    photographerFilter === "ALL"
      ? photos
      : photos.filter((p) => p.photographerId === photographerFilter);

  const coverLinked = linkedAssets.filter((a) => a.usageType === "COVER");
  const bodyLinked = linkedAssets.filter((a) => a.usageType === "INLINE");
  const galleryLinked = linkedAssets.filter((a) => a.usageType === "GALLERY");

  return (
    <section className="space-y-8 rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-[var(--is-surface)] p-5 sm:p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--is-accent)]">
          Medios de la nota
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-[var(--is-text)]">
          Fotos: portada, cuerpo y ComprameLaFoto
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--is-muted)]">
          Definí para qué sirve cada foto. Podés <strong className="font-semibold text-[var(--is-text-secondary)]">subir</strong>{" "}
          desde tu equipo o <strong className="font-semibold text-[var(--is-text-secondary)]">importar</strong> desde una
          cobertura fotográfica de ComprameLaFoto (queda copia editorial permanente).
        </p>
      </div>

      {message ? (
        <p className="rounded-[var(--is-radius-sm)] border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-[var(--is-radius-sm)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      {/* Roles + upload */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--is-muted)]">
          1. ¿Dónde va cada foto?
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {USAGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setUsage(opt.value)}
              className={`rounded-[var(--is-radius-sm)] border px-4 py-4 text-left transition ${
                usage === opt.value
                  ? "border-[var(--is-accent)] bg-[var(--is-orange-50)] ring-2 ring-[var(--is-accent)]/20"
                  : "border-[var(--is-border)] bg-white hover:border-[var(--is-border-strong)]"
              }`}
            >
              <p className="text-sm font-semibold text-[var(--is-text)]">{opt.label}</p>
              <p className="mt-2 text-xs leading-relaxed text-[var(--is-muted)]">{opt.hint}</p>
            </button>
          ))}
        </div>

        <div className="rounded-[var(--is-radius-sm)] border border-dashed border-[var(--is-border-strong)] bg-[var(--is-bg-secondary)] p-4">
          <p className="text-sm font-semibold text-[var(--is-text)]">Subir desde tu equipo</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--is-muted)]">
            JPG, PNG o WebP · máx. 5 MB. El material de ComprameLaFoto se prepara en el
            Asistente Editorial y se inserta desde la Biblioteca.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] bg-white px-4 text-sm font-medium text-[var(--is-text)] hover:border-[var(--is-accent)] hover:text-[var(--is-accent)]">
              {uploading ? "Subiendo…" : "Subir portada"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={uploading || pending}
                onChange={(e) => {
                  void uploadLocal(e.target.files?.[0] ?? null, "cover");
                  e.target.value = "";
                }}
              />
            </label>
            <label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] bg-white px-4 text-sm font-medium text-[var(--is-text)] hover:border-[var(--is-accent)] hover:text-[var(--is-accent)]">
              {uploading ? "Subiendo…" : "Subir al cuerpo"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={uploading || pending}
                onChange={(e) => {
                  void uploadLocal(e.target.files?.[0] ?? null, "inline");
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Ya vinculadas agrupadas */}
      {linkedAssets.length > 0 ? (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--is-muted)]">
            Ya en esta nota
          </h3>
          {(
            [
              ["Portada", coverLinked],
              ["Cuerpo", bodyLinked],
              ["Galería", galleryLinked],
            ] as const
          ).map(([label, items]) =>
            items.length > 0 ? (
              <div key={label} className="space-y-2">
                <p className="text-sm font-medium text-[var(--is-text)]">{label}</p>
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((asset) => (
                    <li
                      key={asset.linkId}
                      className="overflow-hidden rounded-[var(--is-radius-sm)] border border-[var(--is-border)] bg-white"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={asset.thumbnailUrl || asset.url}
                        alt=""
                        className="aspect-video w-full object-cover"
                        draggable={false}
                      />
                      <div className="space-y-2 p-3 text-xs text-[var(--is-muted)]">
                        <p className="font-semibold text-[var(--is-text)]">
                          {USAGE_BADGE[asset.usageType]}
                        </p>
                        <p className="leading-relaxed">{asset.credit || "Sin crédito"}</p>
                        <button
                          type="button"
                          disabled={pending}
                          className="min-h-11 text-red-700 hover:underline disabled:opacity-50"
                          onClick={() =>
                            startTransition(async () => {
                              const result = await removeArticleAssetLinkAction(
                                articleId,
                                asset.linkId,
                              );
                              flash(
                                result.ok ? result.message : null,
                                result.ok ? null : result.error,
                              );
                              if (result.ok) router.refresh();
                            })
                          }
                        >
                          Quitar
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null,
          )}
        </div>
      ) : null}

      {/* Evento CLF */}
      <div className="space-y-3 border-t border-[var(--is-border)] pt-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--is-muted)]">
          2. Evento de ComprameLaFoto
        </h3>
        {eventId ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--is-radius-sm)] border border-[var(--is-border)] bg-white px-4 py-3">
            <div>
              <p className="font-medium text-[var(--is-text)]">
                {eventTitle || "Evento vinculado"}
              </p>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() => void unlinkEvent()}
              className="min-h-11 text-sm text-red-700 hover:underline disabled:opacity-50"
            >
              Desvincular
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (query.trim().length >= 2) void searchEvents();
                }
              }}
              placeholder="Buscar por nombre, organizador, ciudad…"
              className="min-h-11 flex-1 rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] px-3 text-sm"
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
          <ul className="divide-y divide-[var(--is-border)] overflow-hidden rounded-[var(--is-radius-sm)] border border-[var(--is-border)] bg-white">
            {events.map((ev) => (
              <li key={ev.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-[var(--is-text)]">{ev.title}</p>
                  <p className="text-xs text-[var(--is-muted)]">
                    {formatDateEs(ev.startsAt)} · {ev.city}
                    {ev.locationName ? ` · ${ev.locationName}` : ""} · {ev.organizerName} ·{" "}
                    {ev.albumCount} cobertura{ev.albumCount === 1 ? "" : "s"}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void selectEvent(ev)}
                  className="min-h-11 shrink-0 text-sm font-semibold text-[var(--is-accent)] hover:underline"
                >
                  Seleccionar
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* Álbum */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--is-muted)]">
          3. Cobertura fotográfica
        </h3>
        {albumId ? (
          <div className="rounded-[var(--is-radius-sm)] border border-[var(--is-border)] bg-white px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium text-[var(--is-text)]">
                  {albumTitle || "Cobertura vinculada"}
                </p>
                {albumStatus ? (
                  <p className="mt-1 text-sm text-[var(--is-text-secondary)]">
                    {statusLabel[albumStatus]}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending || photosLoading}
                  onClick={() => void loadPhotos(albumId)}
                  className="min-h-11 rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] px-3 text-sm font-medium text-[var(--is-text)] hover:border-[var(--is-accent)] hover:text-[var(--is-accent)] disabled:opacity-50"
                >
                  {photosLoading ? "Cargando fotos…" : "Recargar fotos"}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void unlinkAlbum()}
                  className="min-h-11 text-sm text-red-700 hover:underline disabled:opacity-50"
                >
                  Desvincular
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {albumsLoading ? (
          <p className="text-sm text-[var(--is-muted)]">Cargando coberturas del evento…</p>
        ) : albums.length > 0 ? (
          <ul className="space-y-2">
            {albums.map((album) => {
              const isActive = album.id === albumId;
              return (
                <li
                  key={album.id}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-[var(--is-radius-sm)] border px-4 py-3 ${
                    isActive
                      ? "border-[var(--is-accent)] bg-[var(--is-orange-50)]"
                      : "border-[var(--is-border)] bg-white"
                  }`}
                >
                  <div>
                    <p className="font-medium text-[var(--is-text)]">{album.title}</p>
                    <p className="text-xs text-[var(--is-muted)]">
                      {album.photographerName} · {album.photoCount} fotos ·{" "}
                      {statusLabel[album.availability.status]}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={pending || isActive}
                    onClick={() => void selectAlbum(album)}
                    className="min-h-11 text-sm font-semibold text-[var(--is-accent)] hover:underline disabled:opacity-40"
                  >
                    {isActive ? "En uso" : "Usar cobertura"}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : eventId && hydrated && !albumId ? (
          <p className="text-sm text-[var(--is-muted)]">
            No hay coberturas activas para este evento en ComprameLaFoto.
          </p>
        ) : null}
      </div>

      {/* Fotos del álbum */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--is-muted)]">
              4. Elegir fotografías
            </h3>
            <p className="mt-1 text-xs text-[var(--is-muted)]">
              Destino actual:{" "}
              <span className="font-semibold text-[var(--is-text-secondary)]">
                {USAGE_OPTIONS.find((o) => o.value === usage)?.label}
              </span>
              . Seleccioná y luego importá.
            </p>
          </div>
          {photos.length > 0 ? (
            <button
              type="button"
              disabled={pending || selected.length === 0}
              onClick={() => void importSelected()}
              className="min-h-11 rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              Importar como {USAGE_OPTIONS.find((o) => o.value === usage)?.label.toLowerCase()} (
              {selected.length})
            </button>
          ) : null}
        </div>

        {!albumId ? (
          <p className="rounded-[var(--is-radius-sm)] border border-dashed border-[var(--is-border)] px-4 py-6 text-center text-sm text-[var(--is-muted)]">
            Vinculá una cobertura arriba para ver las fotos disponibles.
          </p>
        ) : photosLoading || (!hydrated && initialAlbumId) ? (
          <p className="text-sm text-[var(--is-muted)]">Cargando fotografías…</p>
        ) : photos.length > 0 ? (
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
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {visiblePhotos.map((photo) => {
                const isOn = selected.includes(photo.id);
                return (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => togglePhoto(photo.id)}
                    className={`overflow-hidden rounded-[var(--is-radius-sm)] border bg-white text-left transition ${
                      isOn
                        ? "border-[var(--is-accent)] ring-2 ring-[var(--is-accent)]/30"
                        : "border-[var(--is-border)] hover:border-[var(--is-border-strong)]"
                    }`}
                  >
                    <EditorialPhotoThumbnail
                      preview={{
                        ...toEditorialPhotoPreview({
                          photoId: photo.id,
                          albumId: albumId!,
                          photographerName: photo.photographerName,
                        }),
                        previewUrl: photo.thumbApiPath,
                      }}
                      showPhotographer={false}
                      className="pointer-events-none"
                    />
                    <div className="space-y-1 p-2 text-[10px] leading-snug text-[var(--is-muted)]">
                      <p className="font-semibold text-[var(--is-text)]">{photo.photographerName}</p>
                      {photo.hasEditorialCopy ? (
                        <p className="text-teal-700">Ya importada</p>
                      ) : (
                        <p>Tocá para seleccionar</p>
                      )}
                    </div>
                    {isOn ? (
                      <div
                        className="space-y-1.5 border-t border-[var(--is-border)] p-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <textarea
                          value={altTexts[photo.id] ?? ""}
                          onChange={(e) =>
                            setAltTexts((prev) => ({ ...prev, [photo.id]: e.target.value }))
                          }
                          rows={2}
                          maxLength={300}
                          placeholder="Descripción (alt text) *"
                          className={`w-full resize-y rounded border px-2 py-1 text-xs ${
                            (altTexts[photo.id] ?? "").trim()
                              ? "border-[var(--is-border)]"
                              : "border-amber-300 bg-amber-50/70"
                          }`}
                        />
                        <input
                          value={captions[photo.id] ?? ""}
                          onChange={(e) =>
                            setCaptions((prev) => ({ ...prev, [photo.id]: e.target.value }))
                          }
                          placeholder="Epígrafe (opcional)"
                          className="w-full rounded border border-[var(--is-border)] px-2 py-1 text-xs"
                        />
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <p className="rounded-[var(--is-radius-sm)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Esta cobertura no tiene fotos disponibles ahora (pueden estar ocultas o sin vista
            previa). Probá <strong>Recargar fotos</strong> o elegí otra cobertura.
          </p>
        )}
      </div>
    </section>
  );
}
