"use client";

import { useEffect, useState } from "react";
import ProtectedAlbumWrapper from "@/components/photo/ProtectedAlbumWrapper";
import EventGalleryGrid from "@/app/g/[shareSlug]/EventGalleryGrid";
import { buildEventGalleryPhotoGridItem } from "@/lib/events/event-gallery-public-photos";

type GalleryPhoto = {
  id: number;
  previewUrl: string | null;
  albumId: number;
  albumSlug: string | null;
  photographerName: string | null;
};

type GalleryResponse = {
  photos: GalleryPhoto[];
};

export default function EventGallery({ shareSlug }: { shareSlug: string }) {
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/public/events/${shareSlug}/gallery`);
        const data = (await res.json().catch(() => ({}))) as GalleryResponse;
        if (!active) return;
        if (!res.ok) {
          setError("No se pudo cargar la galería.");
          return;
        }
        setPhotos(Array.isArray(data.photos) ? data.photos : []);
      } catch {
        if (!active) return;
        setError("Error de conexión.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [shareSlug]);

  if (loading) {
    return <p className="text-sm text-gray-500 mb-6">Cargando galería...</p>;
  }

  if (error) {
    return <p className="text-sm text-red-600 mb-6">{error}</p>;
  }

  if (photos.length === 0) {
    return null;
  }

  const gridPhotos = photos.map((photo) =>
    buildEventGalleryPhotoGridItem({
      id: photo.id,
      albumId: photo.albumId,
      photographerName: photo.photographerName,
      mode: "thumb",
    })
  );

  return (
    <ProtectedAlbumWrapper enableProtection={photos.length > 0}>
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Galería del evento</h2>
          <span className="text-xs text-gray-500">
            {photos.length} foto(s)
          </span>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Cada foto respeta el precio definido por su fotógrafo. Las vistas previas incluyen marca de agua.
        </p>
        <EventGalleryGrid photos={gridPhotos} />
      </div>
    </ProtectedAlbumWrapper>
  );
}
