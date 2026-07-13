 "use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import EventGalleryGrid from "./EventGalleryGrid";
import { buildPhotoViewApiUrl } from "@/lib/images/public-photo-view-url";

type SearchPhoto = {
  id: number;
  previewUrl: string;
  albumId: number;
  photographerId?: number | null;
  photographerName: string | null;
};

export default function EventGallerySearchSection({ eventId }: { eventId: number }) {
  const [showFaceModal, setShowFaceModal] = useState(false);
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchPhoto[]>([]);
  const [photographers, setPhotographers] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedPhotographerId, setSelectedPhotographerId] = useState<string>("all");
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let active = true;
    fetch(`/api/events/${eventId}/photographers`)
      .then((res) => res.json().catch(() => ({})))
      .then((data) => {
        if (!active) return;
        const list = Array.isArray(data.items)
          ? data.items.filter((p: { id?: number; name?: string | null }) => p?.id && p?.name)
          : [];
        setPhotographers(list);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [eventId]);

  async function handleSearchText() {
    if (searchText.trim().length < 3) return;
    setSearchLoading(true);
    setSearchError(null);
    try {
      const params = new URLSearchParams();
      params.set("q", searchText.trim());
      if (selectedPhotographerId !== "all") {
        params.set("photographerId", selectedPhotographerId);
      }
      const res = await fetch(
        `/api/events/${eventId}/search/text?${params.toString()}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Error buscando texto");
      setSearchResults(Array.isArray(data.items) ? data.items : []);
    } catch (err: any) {
      setSearchError(err?.message || "Error buscando texto");
    } finally {
      setSearchLoading(false);
    }
  }

  async function handleSearchFace(file: File) {
    setSearchLoading(true);
    setSearchError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (selectedPhotographerId !== "all") {
        formData.append("photographerId", selectedPhotographerId);
      }
      const res = await fetch(`/api/events/${eventId}/search/face`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Error buscando rostro");
      setSearchResults(Array.isArray(data.items) ? data.items : []);
    } catch (err: any) {
      setSearchError(err?.message || "Error buscando rostro");
    } finally {
      setSearchLoading(false);
    }
  }

  const ocrModal =
    mounted && showOcrModal
      ? createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
            <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <img src="/OCR.png" alt="" className="h-10 w-10 object-contain" aria-hidden />
                  <h3 className="text-lg font-semibold text-[#1a1a1a]">OCR</h3>
                </div>
                <button
                  type="button"
                  className="text-sm text-[#6b7280] hover:text-[#1a1a1a] p-1"
                  onClick={() => setShowOcrModal(false)}
                  aria-label="Cerrar"
                >
                  Cerrar
                </button>
              </div>
              <p className="text-sm text-[#6b7280] mb-4">
                Escribí acá lo que querés buscar y hacé clic en <strong>Buscar</strong>. Patente, dorsal, camiseta, DNI o nombre.
              </p>
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <input
                      id="event-search-ocr"
                      name="searchText"
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && searchText.trim().length >= 3 && !searchLoading) {
                          handleSearchText();
                          setShowOcrModal(false);
                        }
                      }}
                      placeholder="Ej: apellido, patente, dorsal..."
                      className="w-full border border-[#e5e7eb] rounded-md pl-9 pr-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-offset-0"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af] text-lg">
                      🔎
                    </span>
                  </div>
                  <Button
                    variant="primary"
                    onClick={() => {
                      handleSearchText();
                      setShowOcrModal(false);
                    }}
                    disabled={searchLoading || searchText.trim().length < 3}
                    className="px-6 py-3"
                  >
                    {searchLoading ? "Buscando..." : "Buscar"}
                  </Button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  const faceModal =
    mounted && showFaceModal
      ? createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6">
            <div className="w-full max-w-5xl rounded-2xl bg-white p-6 sm:p-8 shadow-xl min-w-0">
              <div className="flex items-center justify-between mb-4 gap-4">
                <h3 className="text-lg sm:text-xl font-semibold text-[#1a1a1a]">
                  Encontrá tus fotos
                </h3>
                <button
                  type="button"
                  className="text-sm text-[#6b7280] hover:text-[#1a1a1a] shrink-0"
                  onClick={() => setShowFaceModal(false)}
                >
                  Cerrar
                </button>
              </div>
              <p className="text-sm sm:text-base text-[#6b7280] mb-6 leading-relaxed max-w-none">
                Elegí cómo querés cargar tu selfie.
              </p>
              <div className="grid gap-5 sm:grid-cols-2 sm:gap-6">
                <label className="group flex w-full min-w-0 cursor-pointer flex-col items-center justify-center gap-4 rounded-3xl border border-[#e5e7eb] bg-white px-6 py-8 text-center shadow-lg transition hover:border-[#cbd5f5] sm:px-8">
                  <input
                    type="file"
                    accept="image/*"
                    capture="user"
                    className="hidden"
                    ref={cameraInputRef}
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      if (file) {
                        setShowFaceModal(false);
                        handleSearchFace(file);
                      }
                    }}
                  />
                  <div className="flex h-[120px] w-[120px] items-center justify-center rounded-3xl border border-[#e5e7eb] bg-white p-6 shadow-sm sm:h-[140px] sm:w-[140px]">
                    <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
                      <rect x="10" y="18" width="44" height="30" rx="6" fill="#E5E7EB" />
                      <rect x="18" y="14" width="12" height="6" rx="2" fill="#9CA3AF" />
                      <circle cx="32" cy="33" r="10" fill="#FFFFFF" stroke="#6B7280" strokeWidth="3" />
                      <circle cx="46" cy="24" r="2.5" fill="#6B7280" />
                    </svg>
                  </div>
                  <div className="w-full min-w-0 px-1">
                    <p className="text-base font-semibold text-[#1a1a1a]">Tomar selfie</p>
                    <p className="text-sm text-[#6b7280] leading-snug mt-1">
                      Abrí la cámara frontal
                    </p>
                  </div>
                </label>
                <label className="group flex w-full min-w-0 cursor-pointer flex-col items-center justify-center gap-4 rounded-3xl border border-[#e5e7eb] bg-white px-6 py-8 text-center shadow-lg transition hover:border-[#cbd5f5] sm:px-8">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      if (file) {
                        setShowFaceModal(false);
                        handleSearchFace(file);
                      }
                    }}
                  />
                  <div className="flex h-[120px] w-[120px] items-center justify-center rounded-3xl border border-[#e5e7eb] bg-white p-6 shadow-sm sm:h-[140px] sm:w-[140px]">
                    <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
                      <path d="M32 14v26" stroke="#6B7280" strokeWidth="4" strokeLinecap="round" />
                      <path d="M24 26l8-8 8 8" stroke="#6B7280" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                      <rect x="12" y="40" width="40" height="12" rx="6" fill="#E5E7EB" />
                    </svg>
                  </div>
                  <div className="w-full min-w-0 px-1">
                    <p className="text-base font-semibold text-[#1a1a1a]">Subir archivo</p>
                    <p className="text-sm text-[#6b7280] leading-snug mt-1">
                      Elegí una selfie guardada
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <section className="mb-8 border border-[#e5e7eb] rounded-2xl p-5 bg-white shadow-sm">
        <div className="mb-5">
          <h2 className="text-xl font-semibold text-[#1a1a1a]">Buscá tus fotos con IA</h2>
          <p className="text-sm text-[#6b7280] mt-2">
            Elegí una opción: reconocimiento facial con selfie o búsqueda por palabras clave
            (patente, dorsal, DNI, nombre).
          </p>
          {photographers.length > 0 && (
            <div className="mt-4 max-w-md">
              <label className="block text-xs font-semibold text-[#6b7280] mb-2">
                Filtrar por fotógrafo
              </label>
              <select
                value={selectedPhotographerId}
                onChange={(e) => setSelectedPhotographerId(e.target.value)}
                className="w-full rounded-md border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[#c27b3d]/30"
              >
                <option value="all">Todos los fotógrafos</option>
                {photographers.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="flex flex-col items-center">
          <div className="grid w-full max-w-4xl gap-6 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setShowFaceModal(true)}
              className="flex w-full flex-col items-center justify-center gap-4 rounded-[28px] border border-[#e5e7eb] px-6 py-6 text-center shadow-lg transition hover:border-[#cbd5f5] sm:h-[260px] sm:w-full sm:py-0"
            >
              <img
                src="/faceid.png"
                alt="Encontrá tus fotos"
                className="h-[195px] w-[195px] rounded-3xl border border-[#e5e7eb] bg-white p-5 object-contain sm:h-[235px] sm:w-[235px]"
              />
              <div>
                <p className="text-base font-semibold text-[#1a1a1a]">Encontrá tu foto</p>
                <p className="text-xs text-[#6b7280]">Reconocimiento facial con IA</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setShowOcrModal(true)}
              className="flex w-full flex-col items-center justify-center gap-4 rounded-[28px] border border-[#e5e7eb] px-6 py-6 text-center shadow-lg transition hover:border-[#cbd5f5] sm:h-[260px] sm:w-full sm:py-0"
            >
              <img
                src="/OCR.png"
                alt="OCR"
                className="h-[195px] w-[195px] rounded-3xl border border-[#e5e7eb] bg-white p-5 object-contain sm:h-[235px] sm:w-[235px]"
              />
              <div>
                <p className="text-base font-semibold text-[#1a1a1a]">Buscá por número</p>
                <p className="text-xs text-[#6b7280]">
                  Camiseta, patente, pechera, dorsal
                </p>
              </div>
            </button>
          </div>
        </div>
        {searchLoading && (
          <div className="mt-4 flex items-center gap-2 text-sm text-[#6b7280]">
            <span className="animate-pulse">⏳</span>
            Procesando búsqueda...
          </div>
        )}
        {searchError && <p className="mt-3 text-sm text-[#ef4444]">{searchError}</p>}
      </section>
      {searchResults.length > 0 && (
        <section className="mb-14 rounded-3xl border border-[#f0e2d4] bg-[#fff9f3] p-5 sm:p-7 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#fde9d6] px-3 py-1 text-xs font-semibold text-[#a05d2a]">
                Resultados destacados
              </div>
              <h3 className="text-xl sm:text-2xl font-semibold text-[#1a1a1a]">
                Fotos encontradas en tu búsqueda
              </h3>
              <p className="text-sm sm:text-base text-[#6b7280]">
                Encontramos {searchResults.length} foto{searchResults.length === 1 ? "" : "s"} que coinciden con tu búsqueda.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSearchResults([])}
              className="text-sm text-[#6b7280] hover:text-[#1a1a1a] underline"
            >
              Limpiar resultados
            </button>
          </div>
          <div className="mt-6">
            <EventGalleryGrid
              photos={searchResults.map((photo) => ({
                id: String(photo.id),
                src: buildPhotoViewApiUrl(photo.id, photo.albumId, "thumb"),
                alt: `Foto ${photo.id}`,
                albumId: photo.albumId,
                photographerId: photo.photographerId ?? null,
                photographerName: photo.photographerName ?? null,
              }))}
            />
          </div>
        </section>
      )}
      {searchResults.length > 0 && (
        <div className="my-10 border-t border-[#e5e7eb]" />
      )}
      {ocrModal}
      {faceModal}
    </>
  );
}
