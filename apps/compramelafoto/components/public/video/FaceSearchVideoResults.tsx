"use client";

import type { VideoSelfieHit } from "@/lib/videos/video-frame-matching";

type Props = {
  videos: VideoSelfieHit[];
  onOpenVideo?: (videoId: number) => void;
};

/**
 * Los videos donde aparece la persona que mandó la selfie.
 *
 * Lo que hace distinto a esto de una galería es el **minuto exacto**: no le
 * decimos "estás en este video", le decimos "aparecés en el 4:32". El fotograma
 * del que salió la coincidencia trae ese dato de regalo.
 *
 * Se muestra junto a las fotos encontradas, no en otra pestaña: para el cliente
 * es una sola búsqueda con un solo resultado.
 */
export default function FaceSearchVideoResults({ videos, onOpenVideo }: Props) {
  if (videos.length === 0) return null;

  return (
    <section aria-label="Videos donde aparecés" className="mt-6 min-w-0">
      <h3 className="mb-3 text-sm font-semibold text-[#111827]">
        {videos.length === 1
          ? "También aparecés en un video"
          : `También aparecés en ${videos.length} videos`}
      </h3>

      <ul className="flex flex-col gap-3">
        {videos.map((video) => (
          <li key={video.videoId}>
            <button
              type="button"
              onClick={() => onOpenVideo?.(video.videoId)}
              className="flex w-full flex-wrap items-center gap-3 rounded-lg border border-[#e5e7eb] bg-white px-3 py-3 text-left transition hover:border-[#111827]"
            >
              {video.thumbnailUrl ? (
                <img
                  src={video.thumbnailUrl}
                  alt=""
                  className="h-14 w-24 flex-shrink-0 rounded object-cover"
                />
              ) : (
                <div className="h-14 w-24 flex-shrink-0 rounded bg-[#1a1a2e]" />
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-[#111827]">
                  {video.title?.trim() || video.categoryLabel}
                </p>
                {/* Este es el dato que no tiene ninguna otra plataforma. */}
                <p className="text-sm text-[#374151]">
                  Aparecés en el minuto{" "}
                  <span className="font-semibold">{video.timestampLabel}</span>
                </p>
              </div>

              <span className="whitespace-nowrap text-sm font-medium text-[#111827] underline">
                Ver
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
