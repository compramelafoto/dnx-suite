/**
 * Arquitectura preparada para colecciones / featured / presets (fase futura).
 * Sin wiring a UI ni backend todavía.
 */

import type { VisualCatalogCategoryId } from "@/lib/catalog-templates/visual-categories";

export type CatalogTemplateCollectionId =
  | "featured"
  | "escolar-presets"
  | "deportes-presets"
  | "sociales-presets";

export type CatalogTemplateCollection = {
  id: CatalogTemplateCollectionId;
  label: string;
  description: string;
  /** Slugs de plantillas incluidas (orden sugerido) */
  templateSlugs: string[];
  /** Para hero / destacados en marketplace */
  featured?: boolean;
  /** Rubro visual asociado */
  visualCategoryHint?: VisualCatalogCategoryId;
  /** Orden en UI futura */
  sortOrder: number;
};

/** Colecciones stub — listas para conectar cuando exista drag/drop o presets por rubro. */
export const CATALOG_TEMPLATE_COLLECTIONS: CatalogTemplateCollection[] = [
  {
    id: "featured",
    label: "Destacados",
    description: "Plantillas más usadas para arrancar rápido.",
    templateSlugs: [
      "pack-fotos-digitales",
      "carpeta-escolar-basica",
      "combo-digital-impresiones",
    ],
    featured: true,
    sortOrder: 0,
  },
  {
    id: "escolar-presets",
    label: "Presets escolares",
    description: "Carpetas, diplomas y packs institucionales.",
    templateSlugs: [
      "carpeta-escolar-basica",
      "carpeta-escolar-premium",
      "diploma-graduacion-personalizado",
    ],
    visualCategoryHint: "escolar",
    sortOrder: 10,
  },
  {
    id: "deportes-presets",
    label: "Presets deportivos",
    description: "Reservado para packs de torneos y clubes.",
    templateSlugs: ["pack-fotos-digitales", "todas-las-fotos-evento"],
    sortOrder: 20,
  },
  {
    id: "sociales-presets",
    label: "Presets sociales",
    description: "Reservado para XV, casamientos y eventos sociales.",
    templateSlugs: ["combo-digital-impresiones", "cuadro-impreso-mdf"],
    sortOrder: 30,
  },
];

export function getCatalogTemplateCollection(id: CatalogTemplateCollectionId) {
  return CATALOG_TEMPLATE_COLLECTIONS.find((c) => c.id === id) ?? null;
}

export function getFeaturedTemplateSlugs(): string[] {
  const featured = CATALOG_TEMPLATE_COLLECTIONS.find((c) => c.id === "featured");
  return featured?.templateSlugs ?? [];
}
