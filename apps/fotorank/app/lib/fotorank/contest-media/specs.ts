/**
 * Contrato de las imágenes de presentación de un concurso.
 *
 * Un solo lugar decide qué tipos de imagen existen, qué tamaño debe tener cada
 * una y cuánto puede pesar. La UI, la validación del servidor y el procesado
 * leen de acá, así que no pueden desincronizarse.
 */

export const CONTEST_MEDIA_KINDS = ["BANNER", "CARD", "SOCIAL"] as const;
export type ContestMediaKind = (typeof CONTEST_MEDIA_KINDS)[number];

/** Formatos que aceptamos de entrada. Sin SVG: es ejecutable, no una foto. */
export const CONTEST_MEDIA_ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export type ContestMediaMime = (typeof CONTEST_MEDIA_ALLOWED_MIME)[number];

/** Tamaño máximo del archivo que sube la persona, antes de optimizar. */
export const CONTEST_MEDIA_MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB

/**
 * Mínimo de entrada. Por debajo de 1200 px de ancho el banner se ve blando en
 * pantallas grandes y no hay forma de arreglarlo agrandando: sólo se pixela.
 */
export const CONTEST_MEDIA_MIN_SOURCE_WIDTH = 1200;
export const CONTEST_MEDIA_MIN_SOURCE_HEIGHT = 675;

/**
 * Techo defensivo. Una imagen de 20.000 px de lado no es un caso real de uso y
 * sí es una forma barata de agotar la memoria del servidor al decodificarla.
 */
export const CONTEST_MEDIA_MAX_SOURCE_DIMENSION = 12000;

export type ContestMediaSpec = {
  kind: ContestMediaKind;
  label: string;
  /** Qué es y dónde se ve, en lenguaje de quien organiza el concurso. */
  description: string;
  width: number;
  height: number;
  /** Calidad de compresión del derivado. */
  quality: number;
  /** Peso objetivo del archivo ya optimizado, para avisar si se pasa. */
  targetMaxBytes: number;
};

/**
 * Las tres salidas son 16:9.
 *
 * Sobre Open Graph: el estándar de facto es 1200×630 (1.91:1), pero recortar a
 * esa proporción obliga a comer 45 px arriba y abajo de una imagen pensada en
 * 16:9, y quien diseñó el flyer no contaba con eso. 1200×675 es 16:9 exacto,
 * entra en los límites de Facebook, X, WhatsApp y LinkedIn, y muestra la pieza
 * completa. Preferimos respetar el encuadre original antes que el píxel exacto
 * del estándar.
 */
export const CONTEST_MEDIA_SPECS: Record<ContestMediaKind, ContestMediaSpec> = {
  BANNER: {
    kind: "BANNER",
    label: "Banner principal",
    description:
      "Imagen horizontal grande de la página del concurso. Es lo primero que se ve al entrar.",
    width: 1920,
    height: 1080,
    quality: 82,
    targetMaxBytes: 600 * 1024,
  },
  CARD: {
    kind: "CARD",
    label: "Imagen de la tarjeta",
    description:
      "Versión chica que aparece en el listado de convocatorias, junto al título del concurso.",
    width: 960,
    height: 540,
    quality: 80,
    targetMaxBytes: 220 * 1024,
  },
  SOCIAL: {
    kind: "SOCIAL",
    label: "Imagen para compartir",
    description:
      "La que se ve cuando alguien comparte el concurso por WhatsApp, Facebook o X.",
    width: 1200,
    height: 675,
    quality: 84,
    targetMaxBytes: 300 * 1024,
  },
};

/** Proporción de todas las salidas. */
export const CONTEST_MEDIA_ASPECT_RATIO = 16 / 9;

/**
 * Tolerancia al comparar la proporción de la imagen de origen.
 * 0.02 acepta 1920×1080 y también 1920×1078 (un recorte a ojo), pero rechaza
 * un cuadrado o un vertical, que al llevarlos a 16:9 perderían medio motivo.
 */
export const CONTEST_MEDIA_ASPECT_TOLERANCE = 0.02;

export function isContestMediaKind(value: unknown): value is ContestMediaKind {
  return typeof value === "string" && (CONTEST_MEDIA_KINDS as readonly string[]).includes(value);
}

export function contestMediaSpec(kind: ContestMediaKind): ContestMediaSpec {
  return CONTEST_MEDIA_SPECS[kind];
}

/** Diferencia entre la proporción recibida y 16:9. */
export function aspectRatioDelta(width: number, height: number): number {
  if (width <= 0 || height <= 0) return Number.POSITIVE_INFINITY;
  return Math.abs(width / height - CONTEST_MEDIA_ASPECT_RATIO);
}

export function isSixteenByNine(width: number, height: number): boolean {
  return aspectRatioDelta(width, height) <= CONTEST_MEDIA_ASPECT_TOLERANCE;
}

/** Texto legible para la UI: "1920 × 1080 px". */
export function formatDimensions(width: number, height: number): string {
  return `${width} × ${height} px`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
