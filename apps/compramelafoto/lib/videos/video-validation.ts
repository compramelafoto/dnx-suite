import { VideoCategory } from "@/lib/prisma";

export const VIDEO_ACTIVE_DAYS = 15;

export const VIDEO_CATEGORIES = [
  "REEL",
  "HIGHLIGHT",
  "CEREMONY",
  "DRONE",
  "INTERVIEW",
  "BACKSTAGE",
  "SHOW",
  "SPORT",
  "SCHOOL",
  "OTHER",
] as const satisfies readonly VideoCategory[];

export type VideoCategoryId = (typeof VIDEO_CATEGORIES)[number];

export const VIDEO_CATEGORY_LABELS: Record<VideoCategory, string> = {
  REEL: "Reel",
  HIGHLIGHT: "Highlight",
  CEREMONY: "Ceremonia",
  DRONE: "Drone",
  INTERVIEW: "Entrevista",
  BACKSTAGE: "Backstage",
  SHOW: "Show",
  SPORT: "Deportivo",
  SCHOOL: "Escolar",
  OTHER: "Otro",
};

const ALLOWED_MIME = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

/** Límites por categoría: tamaño máximo en bytes y duración máxima en segundos. */
export const VIDEO_LIMITS_BY_CATEGORY: Record<
  VideoCategory,
  { maxBytes: number; maxDurationSeconds: number }
> = {
  REEL: { maxBytes: 150 * 1024 * 1024, maxDurationSeconds: 90 },
  HIGHLIGHT: { maxBytes: 500 * 1024 * 1024, maxDurationSeconds: 5 * 60 },
  SPORT: { maxBytes: 500 * 1024 * 1024, maxDurationSeconds: 5 * 60 },
  CEREMONY: { maxBytes: 1024 * 1024 * 1024, maxDurationSeconds: 15 * 60 },
  SHOW: { maxBytes: 1024 * 1024 * 1024, maxDurationSeconds: 15 * 60 },
  SCHOOL: { maxBytes: 1024 * 1024 * 1024, maxDurationSeconds: 15 * 60 },
  DRONE: { maxBytes: 800 * 1024 * 1024, maxDurationSeconds: 8 * 60 },
  INTERVIEW: { maxBytes: 400 * 1024 * 1024, maxDurationSeconds: 10 * 60 },
  BACKSTAGE: { maxBytes: 400 * 1024 * 1024, maxDurationSeconds: 10 * 60 },
  OTHER: { maxBytes: 500 * 1024 * 1024, maxDurationSeconds: 5 * 60 },
};

/** Precio mínimo en centavos ARS por categoría (100 centavos = $1). */
export const VIDEO_MIN_PRICE_CENTS_BY_CATEGORY: Record<VideoCategory, number> = {
  REEL: 300_000,
  HIGHLIGHT: 500_000,
  CEREMONY: 800_000,
  DRONE: 600_000,
  INTERVIEW: 400_000,
  BACKSTAGE: 400_000,
  SHOW: 800_000,
  SPORT: 500_000,
  SCHOOL: 500_000,
  OTHER: 400_000,
};

export const VIDEO_DEFAULT_PRICE_CENTS = 1_000_000;

const EXT_BY_MIME: Record<string, string> = {
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/webm": ".webm",
};

export function isVideoCategory(value: string): value is VideoCategory {
  return (VIDEO_CATEGORIES as readonly string[]).includes(value);
}

export function extensionForVideoMime(mime: string): string {
  return EXT_BY_MIME[mime.toLowerCase()] ?? ".mp4";
}

export function validateVideoUploadParams(params: {
  contentType: string;
  sizeBytes: number;
  category: string;
}): { category: VideoCategory; limits: (typeof VIDEO_LIMITS_BY_CATEGORY)[VideoCategory] } {
  const mime = params.contentType.trim().toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    throw new VideoValidationError(
      "Formato no soportado. Usá MP4, MOV (QuickTime) o WebM."
    );
  }

  if (!Number.isFinite(params.sizeBytes) || params.sizeBytes <= 0) {
    throw new VideoValidationError("El tamaño del archivo no es válido.");
  }

  const categoryRaw = params.category.trim().toUpperCase();
  if (!isVideoCategory(categoryRaw)) {
    throw new VideoValidationError("Categoría de video no válida.");
  }

  const limits = VIDEO_LIMITS_BY_CATEGORY[categoryRaw];
  if (params.sizeBytes > limits.maxBytes) {
    const maxMb = Math.round(limits.maxBytes / (1024 * 1024));
    throw new VideoValidationError(
      `El archivo supera el límite de ${maxMb} MB para la categoría ${VIDEO_CATEGORY_LABELS[categoryRaw]}.`
    );
  }

  return { category: categoryRaw, limits };
}

export function resolveVideoPriceCents(
  category: VideoCategory,
  requested?: number | null
): number {
  const min = VIDEO_MIN_PRICE_CENTS_BY_CATEGORY[category];
  if (requested == null || !Number.isFinite(requested)) {
    return Math.max(VIDEO_DEFAULT_PRICE_CENTS, min);
  }
  const rounded = Math.round(requested);
  if (rounded < min) {
    throw new VideoValidationError(
      `El precio mínimo para ${VIDEO_CATEGORY_LABELS[category]} es $${(min / 100).toLocaleString("es-AR")} (centavos: ${min}).`
    );
  }
  return rounded;
}

export function videoExpiresAtFromNow(extensionDays = 0): Date {
  const days = VIDEO_ACTIVE_DAYS + Math.max(0, extensionDays);
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export class VideoValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VideoValidationError";
  }
}
