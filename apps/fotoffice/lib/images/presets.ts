/**
 * Fuente única de verdad de "para qué se usa esta imagen" en FotoOffice.
 * Ningún formulario debe hardcodear resolución/relación/formatos/peso —
 * todos consumen un preset de acá.
 *
 * Un preset nuevo (para un módulo futuro) se agrega acá, no en cada form.
 */
export type ImageAspectRatio = { width: number; height: number };

export type ImagePreset = {
  /** Clave estable, es la que viaja en el upload (`preset=workspaceLogo`). */
  key: string;
  /** Nombre humano para logs/errores, no necesariamente lo que ve el usuario final. */
  label: string;
  widthRecommended: number;
  heightRecommended: number;
  aspectRatio: ImageAspectRatio;
  /** Si la imagen se aleja demasiado de aspectRatio, se avisa (nunca se rechaza por esto). */
  aspectRatioTolerance: number;
  minWidth: number;
  minHeight: number;
  maxFileSizeBytes: number;
  acceptedFormats: readonly ("image/png" | "image/jpeg" | "image/webp")[];
  objectFit: "cover" | "contain";
};

const MB = 1024 * 1024;

export const IMAGE_PRESETS = {
  workspaceLogo: {
    key: "workspaceLogo",
    label: "Logo de la organización",
    widthRecommended: 1200,
    heightRecommended: 1200,
    aspectRatio: { width: 1, height: 1 },
    aspectRatioTolerance: 0.15,
    minWidth: 200,
    minHeight: 200,
    maxFileSizeBytes: 5 * MB,
    acceptedFormats: ["image/png", "image/jpeg", "image/webp"],
    objectFit: "contain",
  },
  workspaceCover: {
    key: "workspaceCover",
    label: "Portada de la organización",
    widthRecommended: 1920,
    heightRecommended: 1080,
    aspectRatio: { width: 16, height: 9 },
    aspectRatioTolerance: 0.15,
    minWidth: 640,
    minHeight: 360,
    maxFileSizeBytes: 5 * MB,
    acceptedFormats: ["image/jpeg", "image/webp", "image/png"],
    objectFit: "cover",
  },
  memberAvatar: {
    key: "memberAvatar",
    label: "Foto de socio",
    widthRecommended: 800,
    heightRecommended: 800,
    aspectRatio: { width: 1, height: 1 },
    aspectRatioTolerance: 0.15,
    minWidth: 200,
    minHeight: 200,
    maxFileSizeBytes: 3 * MB,
    acceptedFormats: ["image/jpeg", "image/png", "image/webp"],
    objectFit: "cover",
  },
  photographerAvatar: {
    key: "photographerAvatar",
    label: "Foto de perfil",
    widthRecommended: 800,
    heightRecommended: 800,
    aspectRatio: { width: 1, height: 1 },
    aspectRatioTolerance: 0.15,
    minWidth: 200,
    minHeight: 200,
    maxFileSizeBytes: 3 * MB,
    acceptedFormats: ["image/jpeg", "image/png", "image/webp"],
    objectFit: "cover",
  },
  courseCover: {
    key: "courseCover",
    label: "Portada de curso",
    widthRecommended: 1920,
    heightRecommended: 1080,
    aspectRatio: { width: 16, height: 9 },
    aspectRatioTolerance: 0.15,
    minWidth: 640,
    minHeight: 360,
    maxFileSizeBytes: 5 * MB,
    acceptedFormats: ["image/jpeg", "image/webp", "image/png"],
    objectFit: "cover",
  },
} as const satisfies Record<string, ImagePreset>;

export type ImagePresetKey = keyof typeof IMAGE_PRESETS;

export function getImagePreset(key: string): ImagePreset | undefined {
  return (IMAGE_PRESETS as Record<string, ImagePreset>)[key];
}

export function isImagePresetKey(key: string): key is ImagePresetKey {
  return Object.prototype.hasOwnProperty.call(IMAGE_PRESETS, key);
}

export function formatImagePresetRecommendation(preset: ImagePreset): string {
  const { width, height } = preset.aspectRatio;
  const formats = preset.acceptedFormats
    .map((f) => f.replace("image/", "").toUpperCase().replace("JPEG", "JPG"))
    .join("/");
  const maxMb = (preset.maxFileSizeBytes / MB).toFixed(0);
  return `Recomendado: ${preset.widthRecommended} × ${preset.heightRecommended} px · ${width}:${height} · ${formats} · máx. ${maxMb} MB`;
}
