"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import PhotoCard from "@/components/photo/PhotoCard";
import PhotoSlideViewer from "@/components/photo/PhotoSlideViewer";
import Button from "@/components/ui/Button";
import { buildPhotoViewApiUrl } from "@/lib/images/public-photo-view-url";

type EventGalleryPhoto = {
  id: string;
  src: string;
  alt: string;
  albumId: number;
  photographerId: number | null;
  photographerName: string | null;
};

export default function EventGalleryGrid({ photos }: { photos: EventGalleryPhoto[] }) {
  const [showViewer, setShowViewer] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showSummary, setShowSummary] = useState(false);
  const [selectedPhotographer, setSelectedPhotographer] = useState<string>("all");
  const [mounted, setMounted] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const photographerOptions = useMemo(() => {
    const options = new Map<string, string>();
    for (const photo of photos) {
      if (!photo.photographerId && !photo.photographerName) continue;
      const key = photo.photographerId ? String(photo.photographerId) : `name:${photo.photographerName}`;
      if (!options.has(key)) {
        options.set(key, photo.photographerName ?? "Fotógrafo participante");
      }
    }
    return Array.from(options.entries()).map(([id, label]) => ({ id, label }));
  }, [photos]);

  const filteredPhotos = useMemo(() => {
    if (selectedPhotographer === "all") return photos;
    if (selectedPhotographer.startsWith("name:")) {
      const name = selectedPhotographer.replace("name:", "");
      return photos.filter((photo) => photo.photographerName === name);
    }
    const id = Number(selectedPhotographer);
    if (!Number.isFinite(id)) return photos;
    return photos.filter((photo) => photo.photographerId === id);
  }, [photos, selectedPhotographer]);

  const viewerPhotos = useMemo(
    () =>
      filteredPhotos.map((photo) => {
        const photoId = Number.parseInt(photo.id, 10);
        return {
          id: photo.id,
          src: Number.isFinite(photoId)
            ? buildPhotoViewApiUrl(photoId, photo.albumId, "preview")
            : photo.src,
          alt: photo.alt,
          selected: selected.has(photo.id),
        };
      }),
    [filteredPhotos, selected]
  );

  function openViewerFor(id: string) {
    const nextIndex = viewerPhotos.findIndex((photo) => photo.id === id);
    if (nextIndex === -1) return;
    setViewerIndex(nextIndex);
    setShowViewer(true);
  }

  function toggleSelection(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function normalizePhotoIdsForQuery(ids: ReadonlyArray<string>): number[] {
    const set = new Set<number>();
    for (const raw of ids) {
      const parsed = parseInt(String(raw).trim(), 10);
      if (Number.isFinite(parsed) && parsed > 0) set.add(Math.trunc(parsed));
    }
    return Array.from(set).sort((a, b) => a - b);
  }

  function buildCheckoutUrl(albumId: number, photoIds: string[]) {
    const normalized = normalizePhotoIdsForQuery(photoIds);
    if (normalized.length === 0) return `/a/${albumId}/comprar`;
    const params = new URLSearchParams();
    params.set("photoIds", normalized.join(","));
    return `/a/${albumId}/comprar?${params.toString()}`;
  }

  const selectedCount = selected.size;
  const selectedGroups = useMemo(() => {
    const groups = new Map<
      number,
      { albumId: number; photographerName: string | null; photoIds: string[] }
    >();
    for (const id of selected) {
      const photo = photos.find((p) => p.id === id);
      if (!photo) continue;
      const group = groups.get(photo.albumId) || {
        albumId: photo.albumId,
        photographerName: photo.photographerName,
        photoIds: [],
      };
      group.photoIds.push(photo.id);
      groups.set(photo.albumId, group);
    }
    return Array.from(groups.values()).sort((a, b) => a.albumId - b.albumId);
  }, [selected, photos]);

  function handleUnifiedCheckout() {
    if (selectedGroups.length === 0) return;
    setIsRedirecting(true);
    for (const group of selectedGroups) {
      window.location.href = buildCheckoutUrl(group.albumId, group.photoIds);
    }
  }

  const summaryModal =
    mounted && showSummary
      ? createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6 sm:px-6">
            <div className="w-full max-w-4xl rounded-3xl bg-white p-6 sm:p-10 shadow-2xl">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <h3 className="text-2xl sm:text-3xl font-semibold text-[#1a1a1a]">Tu compra</h3>
                  <p className="text-sm sm:text-base text-[#6b7280]">
                    Seleccionaste {selectedCount} foto{selectedCount === 1 ? "" : "s"}.
                  </p>
                  <p className="text-xs sm:text-sm text-[#6b7280]">
                    Incluye fotos de distintos fotógrafos.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSummary(false)}
                  className="self-start text-sm text-[#6b7280] hover:text-[#1a1a1a]"
                  disabled={isRedirecting}
                >
                  Cerrar
                </button>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-3 justify-between">
                <Button
                  variant="primary"
                  onClick={handleUnifiedCheckout}
                  className="px-5 py-2.5"
                  disabled={isRedirecting}
                >
                  {isRedirecting ? "Te estamos llevando a completar tu compra..." : "Continuar con la compra"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setShowSummary(false)}
                  className="px-5 py-2.5"
                  disabled={isRedirecting}
                >
                  Seguir eligiendo
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-900">Filtrar por fotógrafo</p>
          <p className="text-xs text-gray-500">
            {filteredPhotos.length} foto{filteredPhotos.length === 1 ? "" : "s"} visibles
          </p>
        </div>
        <div className="min-w-[220px]">
          <select
            value={selectedPhotographer}
            onChange={(event) => setSelectedPhotographer(event.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-300 focus:outline-none focus:ring-0"
          >
            <option value="all">Todos los fotógrafos</option>
            {photographerOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {selectedCount > 0 && (
        <div className="w-full rounded-2xl border border-[#e5e7eb] bg-[#faf7f4] px-5 py-4 sm:px-6 sm:py-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm sm:text-[15px] text-[#374151]">
              <strong className="text-[#1a1a1a] font-semibold">
                Tenés {selectedCount} foto{selectedCount === 1 ? "" : "s"} seleccionada
                {selectedCount === 1 ? "" : "s"}
              </strong>
              . Podés seguir sumando o ver tu compra.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" onClick={() => setShowSummary(true)}>
                Comprar seleccionadas
              </Button>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="text-sm text-[#6b7280] hover:text-[#1a1a1a] underline"
              >
                Deseleccionar todo
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        {filteredPhotos.map((photo) => (
          <div key={photo.id} className="space-y-3">
            <PhotoCard
              src={photo.src}
              alt={photo.alt}
              selected={selected.has(photo.id)}
              onSelect={() => toggleSelection(photo.id)}
              onOpenSlide={() => openViewerFor(photo.id)}
              showMediaTypeBadge
              noDrag
            />
            <div className="h-4" />
          </div>
        ))}
      </div>
      {showViewer && viewerPhotos.length > 0 ? (
        <PhotoSlideViewer
          photos={viewerPhotos}
          initialIndex={viewerIndex}
          protectUnpurchased
          onClose={() => setShowViewer(false)}
          onPhotoSelect={toggleSelection}
        />
      ) : null}
      {selectedCount > 0 && (
        <button
          type="button"
          onClick={() => setShowSummary(true)}
          className="fixed z-50 right-5 bottom-5 md:right-8 md:bottom-8 px-4 py-3 rounded-full shadow-lg text-white text-sm font-semibold transition-all bg-[#c27b3d] hover:bg-[#a0652d]"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
        >
          Comprar seleccionadas ({selectedCount})
        </button>
      )}
      {summaryModal}
    </div>
  );
}
