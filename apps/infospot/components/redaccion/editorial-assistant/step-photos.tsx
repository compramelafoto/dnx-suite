"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EditorialPhotoThumbnail } from "@/components/editorial-photos/editorial-photo-thumbnail";
import type { AssistantCoverageCard, PhotoRole, SelectedPhoto } from "@/lib/editorial-assistant";
import { photoRoleLabel, photoSelectionSummary } from "@/lib/editorial-assistant";

type PhotoHit = {
  id: number;
  photographerName: string;
  thumbApiPath: string;
};

type Props = {
  coverages: AssistantCoverageCard[];
  selected: SelectedPhoto[];
  onChange: (photos: SelectedPhoto[]) => void;
  onBack: () => void;
  onContinue: () => void;
  continueLabel?: string;
};

export function StepPhotos({
  coverages,
  selected,
  onChange,
  onBack,
  onContinue,
  continueLabel = "Preparar borrador",
}: Props) {
  const [activeAlbumId, setActiveAlbumId] = useState<number | null>(
    coverages[0]?.clfAlbumId ?? null,
  );
  const [photos, setPhotos] = useState<PhotoHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [defaultRole, setDefaultRole] = useState<PhotoRole>("GALLERY");
  const [zoomPath, setZoomPath] = useState<string | null>(null);

  useEffect(() => {
    if (!zoomPath) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoomPath(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomPath]);

  const activeCoverage = coverages.find((c) => c.clfAlbumId === activeAlbumId);

  const selectedMap = useMemo(() => {
    const m = new Map<number, SelectedPhoto>();
    for (const p of selected) m.set(p.clfPhotoId, p);
    return m;
  }, [selected]);

  const summary = photoSelectionSummary(selected);

  const load = useCallback(
    async (albumId: number, reset: boolean, nextCursor: number | null) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          albumId: String(albumId),
          take: "36",
        });
        if (!reset && nextCursor) params.set("cursor", String(nextCursor));
        const res = await fetch(`/api/redaccion/editorial-photos?${params}`, {
          credentials: "include",
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error || `Error ${res.status}`);
        }
        const data = (await res.json()) as {
          photos: PhotoHit[];
          nextCursor: number | null;
          hasMore: boolean;
        };
        setPhotos((prev) => (reset ? data.photos : [...prev, ...data.photos]));
        setCursor(data.nextCursor);
        setHasMore(data.hasMore);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudieron cargar las fotos");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (activeAlbumId == null) return;
    setPhotos([]);
    setCursor(null);
    void load(activeAlbumId, true, null);
  }, [activeAlbumId, load]);

  const toggle = (photo: PhotoHit) => {
    if (!activeCoverage) return;
    const existing = selectedMap.get(photo.id);
    if (existing) {
      onChange(selected.filter((p) => p.clfPhotoId !== photo.id));
      return;
    }
    const next: SelectedPhoto = {
      clfPhotoId: photo.id,
      albumId: activeCoverage.clfAlbumId,
      coverageId: activeCoverage.id,
      thumbApiPath: photo.thumbApiPath,
      photographerName: photo.photographerName,
      role: defaultRole === "COVER" && selected.some((p) => p.role === "COVER")
        ? "GALLERY"
        : defaultRole,
    };
    // Una sola portada
    let list = [...selected, next];
    if (next.role === "COVER") {
      list = list.map((p) =>
        p.clfPhotoId !== next.clfPhotoId && p.role === "COVER"
          ? { ...p, role: "GALLERY" as const }
          : p,
      );
    }
    onChange(list);
  };

  const setRole = (clfPhotoId: number, role: PhotoRole) => {
    onChange(
      selected.map((p) => {
        if (p.clfPhotoId !== clfPhotoId) {
          if (role === "COVER" && p.role === "COVER") {
            return { ...p, role: "GALLERY" };
          }
          return p;
        }
        return { ...p, role };
      }),
    );
  };

  return (
    <div className="space-y-6 pb-36">
      <header className="max-w-2xl">
        <h1 className="font-[family-name:var(--font-source-serif)] text-[clamp(1.75rem,1.3rem+1.5vw,2.5rem)] font-semibold leading-tight tracking-tight">
          Seleccionar fotografías
        </h1>
        <p className="mt-4 text-base leading-relaxed text-[var(--is-muted)]">
          Marcá portada, galería o fotos para insertar. Todavía no decidimos dónde
          va cada una en el texto.
        </p>
      </header>

      {coverages.length > 1 ? (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Coberturas">
          {coverages.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={activeAlbumId === c.clfAlbumId}
              onClick={() => setActiveAlbumId(c.clfAlbumId)}
              className={`min-h-10 rounded-full px-4 text-sm font-medium ${
                activeAlbumId === c.clfAlbumId
                  ? "bg-[var(--is-accent)] text-white"
                  : "border border-[var(--is-border)] bg-white"
              }`}
            >
              {c.title}
            </button>
          ))}
        </div>
      ) : null}

      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Rol al seleccionar"
      >
        {(
          [
            ["COVER", "★ Portada"],
            ["GALLERY", "▣ Galería"],
            ["INLINE", "¶ Para insertar"],
          ] as const
        ).map(([role, label]) => (
          <button
            key={role}
            type="button"
            onClick={() => setDefaultRole(role)}
            className={`min-h-10 rounded-full px-4 text-sm font-medium ${
              defaultRole === role
                ? "bg-[var(--is-text)] text-white"
                : "border border-[var(--is-border)] bg-white"
            }`}
            aria-pressed={defaultRole === role}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="rounded-[var(--is-radius-sm)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      <div
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
        role="listbox"
        aria-label="Fotografías"
        aria-multiselectable="true"
      >
        {loading && photos.length === 0
          ? Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square animate-pulse rounded-[var(--is-radius-sm)] bg-[var(--is-bg-muted)]"
                aria-hidden
              />
            ))
          : null}
        {photos.map((photo) => {
          const sel = selectedMap.get(photo.id);
          return (
            <div key={photo.id} className="group relative" role="option" aria-selected={Boolean(sel)}>
              <button
                type="button"
                onClick={() => toggle(photo)}
                className={`relative block w-full overflow-hidden rounded-[var(--is-radius-sm)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--is-accent)] ${
                  sel ? "ring-2 ring-[var(--is-accent)]" : ""
                }`}
              >
                <EditorialPhotoThumbnail
                  preview={{
                    photoId: String(photo.id),
                    previewUrl: photo.thumbApiPath,
                    photographerName: photo.photographerName,
                    status: "READY",
                    aspectRatio: 1,
                  }}
                  showPhotographer={false}
                  className="w-full"
                />
                <span
                  className={`absolute left-2 top-2 inline-flex size-6 items-center justify-center rounded-md border text-xs font-bold shadow-sm ${
                    sel
                      ? "border-[var(--is-accent)] bg-[var(--is-accent)] text-white"
                      : "border-white/80 bg-black/40 text-white opacity-0 group-hover:opacity-100"
                  }`}
                  aria-hidden
                >
                  {sel ? "✓" : ""}
                </span>
              </button>
              <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                <button
                  type="button"
                  className="rounded bg-black/70 px-2 py-1 text-[10px] font-semibold text-white"
                  onClick={() => setZoomPath(photo.thumbApiPath)}
                >
                  Zoom
                </button>
              </div>
              {sel ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  {(["COVER", "GALLERY", "INLINE"] as const).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setRole(photo.id, role)}
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        sel.role === role
                          ? "bg-[var(--is-accent)] text-white"
                          : "bg-[var(--is-bg-muted)] text-[var(--is-muted)]"
                      }`}
                      aria-label={photoRoleLabel(role)}
                    >
                      {role === "COVER" ? "★" : role === "GALLERY" ? "▣" : "¶"}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {hasMore ? (
        <div className="flex justify-center">
          <button
            type="button"
            disabled={loading || activeAlbumId == null}
            onClick={() => activeAlbumId != null && void load(activeAlbumId, false, cursor)}
            className="min-h-11 rounded-[var(--is-radius-sm)] border border-[var(--is-border)] px-4 text-sm font-medium"
          >
            {loading ? "Cargando…" : "Cargar más"}
          </button>
        </div>
      ) : null}

      {!loading && coverages.length === 0 ? (
        <p className="rounded-[var(--is-radius-md)] border border-dashed border-[var(--is-border)] bg-white p-8 text-center text-sm leading-relaxed text-[var(--is-muted)]">
          No hay coberturas seleccionadas. Volvé a Material editorial o seguí sin fotografías.
        </p>
      ) : null}

      {!loading && coverages.length > 0 && photos.length === 0 ? (
        <p className="rounded-[var(--is-radius-md)] border border-dashed border-[var(--is-border)] bg-white p-8 text-center text-sm leading-relaxed text-[var(--is-muted)]">
          No hay fotografías disponibles en esta cobertura. Probá otra cobertura o continuá sin
          seleccionar fotos.
        </p>
      ) : null}

      {/* Panel inferior fijo */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--is-border)] bg-white/95 px-4 py-4 backdrop-blur md:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm" aria-live="polite">
            <span className="font-semibold">Fotos seleccionadas</span>
            {": "}
            ★ {summary.cover} portada · ▣ {summary.gallery} galería · ¶ {summary.inline}{" "}
            insertar
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] border border-[var(--is-border)] px-4 text-sm font-medium"
            >
              Atrás
            </button>
            <button
              type="button"
              onClick={onContinue}
              className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-5 text-sm font-semibold text-white"
            >
              {continueLabel}
            </button>
          </div>
        </div>
      </div>

      {zoomPath ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Vista ampliada"
          onClick={() => setZoomPath(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 min-h-11 min-w-11 rounded-full bg-white/90 text-sm font-semibold"
            onClick={() => setZoomPath(null)}
            aria-label="Cerrar"
            autoFocus
          >
            ✕
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoomPath}
            alt=""
            className="max-h-[90vh] max-w-[90vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
}
