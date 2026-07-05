import type { VisualCatalogCategoryId } from "@/lib/catalog-templates/visual-categories";
import { getVisualCategory } from "@/lib/catalog-templates/visual-categories";

/** Base pública para assets de plantillas. */
export const CATALOG_TEMPLATE_ASSET_BASE = "/catalog-templates";

/**
 * Rutas locales opcionales por slug (archivos en public/catalog-templates/…).
 * Cuando existan los .webp/.jpg, se usarán automáticamente.
 */
export const TEMPLATE_LOCAL_COVER_PATHS: Partial<Record<string, string>> = {
  "pack-fotos-digitales": "/digitales/pack-fotos-digitales.webp",
  "todas-las-fotos-evento": "/digitales/todas-las-fotos-evento.webp",
  "carpeta-escolar-basica": "/escolar/carpeta-escolar-basica.webp",
  "carpeta-escolar-premium": "/premium/carpeta-escolar-premium.webp",
  "pack-impresiones": "/impresiones/pack-impresiones.webp",
  "combo-digital-impresiones": "/combos/combo-digital-impresiones.webp",
  "combo-llavero-foto-digital": "/souvenirs/combo-llavero-foto-digital.webp",
  "combo-sticker-foto-digital": "/souvenirs/combo-sticker-foto-digital.webp",
  "stickers-foto-archivo-digital": "/souvenirs/stickers-foto-archivo-digital.webp",
  "cuadro-impreso-mdf": "/impresiones/cuadro-impreso-mdf.webp",
  "diploma-graduacion-personalizado": "/graduacion/diploma-graduacion.webp",
};

export type TemplateCoverFallback = {
  gradient: string;
  icon: string;
  initials: string;
  categoryLabel: string;
  categoryId: VisualCatalogCategoryId;
};

export function resolveTemplateCoverUrl(input: {
  slug: string;
  coverImageUrl: string | null;
}): string | null {
  if (input.coverImageUrl?.trim()) return input.coverImageUrl.trim();

  const localPath = TEMPLATE_LOCAL_COVER_PATHS[input.slug];
  if (localPath) return `${CATALOG_TEMPLATE_ASSET_BASE}${localPath}`;

  return null;
}

export function buildTemplateCoverFallback(input: {
  name: string;
  visualCategoryId: VisualCatalogCategoryId;
}): TemplateCoverFallback {
  const cat = getVisualCategory(input.visualCategoryId);
  return {
    gradient: cat.fallbackGradient,
    icon: cat.icon,
    initials: input.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 2) || "P",
    categoryLabel: cat.label,
    categoryId: input.visualCategoryId,
  };
}

/** Indica si la URL es asset local (Next/Image optimizable). */
export function isLocalCatalogTemplateAsset(url: string): boolean {
  return url.startsWith(CATALOG_TEMPLATE_ASSET_BASE);
}
