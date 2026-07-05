/**
 * Categorías visuales del marketplace de plantillas (capa UI — sin lógica de negocio).
 * Fuente única de verdad para chips, fallbacks y estilos de card.
 */

export const VISUAL_CATALOG_CATEGORY_IDS = [
  "digitales",
  "escolar",
  "combos",
  "impresiones",
  "souvenirs",
  "premium",
  "graduacion",
] as const;

export type VisualCatalogCategoryId = (typeof VISUAL_CATALOG_CATEGORY_IDS)[number];

export type VisualCatalogCategory = {
  id: VisualCatalogCategoryId;
  label: string;
  /** Carpeta de assets bajo /public/catalog-templates/ */
  assetFolder: string;
  /** Gradiente suave para fallback (Tailwind, from/via/to) */
  fallbackGradient: string;
  /** Acento de chip/badge */
  chipClass: string;
  /** Icono contextual (emoji sobrio para fallback) */
  icon: string;
};

export const VISUAL_CATALOG_CATEGORIES: Record<VisualCatalogCategoryId, VisualCatalogCategory> = {
  digitales: {
    id: "digitales",
    label: "Digitales",
    assetFolder: "digitales",
    fallbackGradient: "from-[#eff6ff] via-[#dbeafe] to-[#bfdbfe]",
    chipClass: "bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe]",
    icon: "◻",
  },
  escolar: {
    id: "escolar",
    label: "Escolar",
    assetFolder: "escolar",
    fallbackGradient: "from-[#f0fdf4] via-[#dcfce7] to-[#bbf7d0]",
    chipClass: "bg-[#f0fdf4] text-[#15803d] border-[#bbf7d0]",
    icon: "▤",
  },
  combos: {
    id: "combos",
    label: "Combos",
    assetFolder: "combos",
    fallbackGradient: "from-[#f5f3ff] via-[#ede9fe] to-[#ddd6fe]",
    chipClass: "bg-[#f5f3ff] text-[#6d28d9] border-[#ddd6fe]",
    icon: "⊞",
  },
  impresiones: {
    id: "impresiones",
    label: "Impresiones",
    assetFolder: "impresiones",
    fallbackGradient: "from-[#fffbeb] via-[#fef3c7] to-[#fde68a]",
    chipClass: "bg-[#fffbeb] text-[#b45309] border-[#fde68a]",
    icon: "▣",
  },
  souvenirs: {
    id: "souvenirs",
    label: "Souvenirs",
    assetFolder: "souvenirs",
    fallbackGradient: "from-[#fff1f2] via-[#ffe4e6] to-[#fecdd3]",
    chipClass: "bg-[#fff1f2] text-[#be123c] border-[#fecdd3]",
    icon: "◇",
  },
  premium: {
    id: "premium",
    label: "Premium",
    assetFolder: "premium",
    fallbackGradient: "from-[#fafaf9] via-[#f5f5f4] to-[#e7e5e4]",
    chipClass: "bg-[#fafaf9] text-[#57534e] border-[#e7e5e4]",
    icon: "◆",
  },
  graduacion: {
    id: "graduacion",
    label: "Graduación",
    assetFolder: "graduacion",
    fallbackGradient: "from-[#eef2ff] via-[#e0e7ff] to-[#c7d2fe]",
    chipClass: "bg-[#eef2ff] text-[#4338ca] border-[#c7d2fe]",
    icon: "🎓",
  },
};

/** Mapeo explícito slug → categoría visual (prioridad sobre category DB). */
const SLUG_VISUAL_CATEGORY: Record<string, VisualCatalogCategoryId> = {
  "pack-fotos-digitales": "digitales",
  "todas-las-fotos-evento": "digitales",
  "carpeta-escolar-basica": "escolar",
  "carpeta-escolar-premium": "premium",
  "pack-impresiones": "impresiones",
  "combo-digital-impresiones": "combos",
  "combo-llavero-foto-digital": "souvenirs",
  "combo-sticker-foto-digital": "souvenirs",
  "stickers-foto-archivo-digital": "souvenirs",
  "cuadro-impreso-mdf": "impresiones",
  "diploma-graduacion-personalizado": "graduacion",
};

/** Fallback cuando no hay slug en el mapa. */
const DB_CATEGORY_VISUAL: Record<string, VisualCatalogCategoryId> = {
  Digital: "digitales",
  Escolar: "escolar",
  Combo: "combos",
  Impresión: "impresiones",
  Combos: "combos",
  Impresiones: "impresiones",
};

export function resolveVisualCategory(input: {
  slug: string;
  category: string;
  tags?: string[];
  visualCategory?: string | null;
}): VisualCatalogCategoryId {
  if (
    input.visualCategory &&
    VISUAL_CATALOG_CATEGORY_IDS.includes(input.visualCategory as VisualCatalogCategoryId)
  ) {
    return input.visualCategory as VisualCatalogCategoryId;
  }

  const fromSlug = SLUG_VISUAL_CATEGORY[input.slug];
  if (fromSlug) return fromSlug;

  if (input.tags?.includes("premium")) return "premium";
  if (input.tags?.includes("diploma") || input.tags?.includes("graduacion")) return "graduacion";
  if (input.tags?.includes("llavero") || input.tags?.includes("sticker")) return "souvenirs";

  const fromDb = DB_CATEGORY_VISUAL[input.category.trim()];
  if (fromDb) return fromDb;

  return "combos";
}

export function getVisualCategory(id: VisualCatalogCategoryId): VisualCatalogCategory {
  return VISUAL_CATALOG_CATEGORIES[id];
}

export function getVisualCategoryList(): VisualCatalogCategory[] {
  return VISUAL_CATALOG_CATEGORY_IDS.map((id) => VISUAL_CATALOG_CATEGORIES[id]);
}

export function getTemplateInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "P";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
