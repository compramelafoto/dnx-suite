import type { VideoCategory } from "@/lib/prisma";
import { getR2PublicUrl } from "@/lib/r2-client";
import { VIDEO_CATEGORY_LABELS } from "@/lib/videos/video-validation";
import { publicVideoPrice } from "@/lib/videos/public-video-price";

/** Campos mínimos para mapear a DTO público (sin originalKey ni precios). */
export type PublicVideoRow = {
  id: number;
  title: string | null;
  description: string | null;
  category: VideoCategory;
  durationSeconds: number | null;
  orientation: string | null;
  thumbnailKey: string | null;
  previewKey: string | null;
  width: number | null;
  height: number | null;
  uploadedAt: Date;
  /// Centavos reales, como los guarda VideoAsset. No se expone al cliente.
  priceCents: number;
  sellEnabled: boolean;
};

export type PublicVideoDto = {
  id: number;
  title: string | null;
  description: string | null;
  category: string;
  categoryLabel: string;
  durationSeconds: number | null;
  orientation: string | null;
  thumbnailUrl: string | null;
  previewUrl: string | null;
  width: number | null;
  height: number | null;
  createdAt: string;
  /// Lo que paga el cliente, con el fee ya incluido. null si no está en venta.
  priceArs: number | null;
  /// Listo para mostrar: "$11.500".
  priceLabel: string | null;
  purchasable: boolean;
};

function r2UrlOrNull(key: string | null | undefined): string | null {
  if (!key?.trim()) return null;
  try {
    return getR2PublicUrl(key);
  } catch {
    return null;
  }
}

/**
 * El `feePercent` es obligatorio a propósito: con un default silencioso, un
 * listado que se olvide de pasarlo mostraría el precio del fotógrafo como si
 * fuera el del cliente, y la diferencia aparecería recién en el checkout.
 */
export function toPublicVideoDto(
  video: PublicVideoRow,
  feePercent: number
): PublicVideoDto {
  const thumbnailUrl = r2UrlOrNull(video.thumbnailKey);
  // El adelanto se sirve por el dominio del sitio, no por el de R2: ahí el
  // reproductor fallaba con "URL no accesible" aunque el archivo estuviera bien,
  // y además la ubicación real del archivo no tiene por qué viajar al navegador.
  const previewUrl = video.previewKey?.trim()
    ? `/api/public/videos/${video.id}/preview`
    : null;

  if (process.env.NODE_ENV === "development") {
    if (video.previewKey?.trim() && !previewUrl) {
      console.warn("[public-video-dto] previewKey sin URL pública", {
        id: video.id,
        previewKey: video.previewKey,
      });
    }
    if (video.thumbnailKey?.trim() && !thumbnailUrl) {
      console.warn("[public-video-dto] thumbnailKey sin URL pública", {
        id: video.id,
        thumbnailKey: video.thumbnailKey,
      });
    }
  }

  return {
    id: video.id,
    title: video.title,
    description: video.description,
    category: video.category,
    categoryLabel: VIDEO_CATEGORY_LABELS[video.category],
    durationSeconds: video.durationSeconds,
    orientation: video.orientation,
    thumbnailUrl,
    previewUrl,
    width: video.width,
    height: video.height,
    createdAt: video.uploadedAt.toISOString(),
    ...publicVideoPrice(video, feePercent),
  };
}
