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
  /**
   * Sin proporción recomendada: cada imagen es la que es. Lo usa la obra de un fotógrafo, donde
   * hay panorámicas, verticales y cuadradas, y avisar que "se aleja de la proporción" sería
   * decidir por él. `aspectRatio` sigue declarándose porque el tipo lo exige y el visor lo usa
   * como caja por defecto, pero no se valida.
   *
   * Con esto en true, el mínimo de dimensiones se mide sobre el LADO MAYOR, no sobre los dos:
   * una panorámica legítima es más baja que ancha y no por eso está en baja resolución.
   */
  aspectRatioFree?: boolean;
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
    /**
     * 472 px es 4×4 cm a 300 DPI: el mínimo para que la credencial impresa no salga pixelada.
     * Es más exigente que un avatar de pantalla a propósito — esta foto termina impresa, y una
     * imagen que se ve bien en el perfil puede salir borrosa en la tarjeta.
     */
    minWidth: 472,
    minHeight: 472,
    maxFileSizeBytes: 3 * MB,
    acceptedFormats: ["image/jpeg", "image/png", "image/webp"],
    objectFit: "cover",
  },
  memberBusinessLogo: {
    key: "memberBusinessLogo",
    label: "Logo de la empresa del socio",
    widthRecommended: 800,
    heightRecommended: 800,
    // Los logos rara vez son cuadrados: la proporción solo genera un aviso y se muestra entero.
    aspectRatio: { width: 1, height: 1 },
    aspectRatioTolerance: 0.5,
    minWidth: 120,
    minHeight: 120,
    maxFileSizeBytes: 3 * MB,
    acceptedFormats: ["image/png", "image/jpeg", "image/webp"],
    objectFit: "contain",
  },
  blogHero: {
    key: "blogHero",
    label: "Portada de artículo del blog",
    widthRecommended: 1600,
    heightRecommended: 900,
    aspectRatio: { width: 16, height: 9 },
    // Las portadas vienen de donde vengan (el blog viejo de Alboom usa otras proporciones):
    // la proporción sólo genera un aviso.
    aspectRatioTolerance: 0.6,
    minWidth: 400,
    minHeight: 225,
    maxFileSizeBytes: 8 * MB,
    acceptedFormats: ["image/jpeg", "image/png", "image/webp"],
    objectFit: "cover",
  },
  blogMedia: {
    key: "blogMedia",
    label: "Imagen dentro de un artículo del blog",
    widthRecommended: 1600,
    heightRecommended: 1200,
    aspectRatio: { width: 4, height: 3 },
    aspectRatioTolerance: 1,
    minWidth: 200,
    minHeight: 120,
    maxFileSizeBytes: 8 * MB,
    acceptedFormats: ["image/jpeg", "image/png", "image/webp"],
    objectFit: "contain",
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
  websiteHeroImage: {
    key: "websiteHeroImage",
    label: "Imagen de portada del sitio web",
    widthRecommended: 1920,
    heightRecommended: 1080,
    aspectRatio: { width: 16, height: 9 },
    aspectRatioTolerance: 0.2,
    minWidth: 640,
    minHeight: 360,
    maxFileSizeBytes: 6 * MB,
    acceptedFormats: ["image/jpeg", "image/webp", "image/png"],
    objectFit: "cover",
  },
  websiteBlockImage: {
    key: "websiteBlockImage",
    label: "Imagen de bloque del sitio web",
    widthRecommended: 1600,
    heightRecommended: 1200,
    aspectRatio: { width: 4, height: 3 },
    aspectRatioTolerance: 0.25,
    minWidth: 480,
    minHeight: 360,
    maxFileSizeBytes: 6 * MB,
    acceptedFormats: ["image/jpeg", "image/webp", "image/png"],
    objectFit: "cover",
  },
  favicon: {
    key: "favicon",
    label: "Favicon",
    widthRecommended: 512,
    heightRecommended: 512,
    aspectRatio: { width: 1, height: 1 },
    aspectRatioTolerance: 0.05,
    minWidth: 32,
    minHeight: 32,
    maxFileSizeBytes: 1 * MB,
    acceptedFormats: ["image/png", "image/webp"],
    objectFit: "contain",
  },
  memberPortfolioPhoto: {
    key: "memberPortfolioPhoto",
    label: "Foto de portfolio",
    widthRecommended: 2400,
    heightRecommended: 1600,
    /** Sólo la caja por defecto del visor: con `aspectRatioFree` no se valida ni se avisa. */
    aspectRatio: { width: 3, height: 2 },
    aspectRatioTolerance: 1,
    aspectRatioFree: true,
    /**
     * 1000 px de lado mayor. No es el mínimo de una pantalla: es el mínimo para que la foto
     * aguante un monitor grande, que es donde se mira obra.
     */
    minWidth: 1000,
    minHeight: 1000,
    maxFileSizeBytes: 10 * MB,
    acceptedFormats: ["image/jpeg", "image/webp", "image/png"],
    objectFit: "contain",
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
