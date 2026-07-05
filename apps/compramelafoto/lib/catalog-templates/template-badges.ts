import type { SystemCatalogTemplateListItem } from "@/lib/catalog-templates/serialize-template";
import type { VisualCatalogCategoryId } from "@/lib/catalog-templates/visual-categories";

export type CatalogTemplateBadgeId =
  | "recomendado"
  | "escolar"
  | "digital"
  | "premium"
  | "mas-vendido"
  | "nuevo";

export type CatalogTemplateBadge = {
  id: CatalogTemplateBadgeId;
  label: string;
  className: string;
};

const BADGE_STYLES: Record<CatalogTemplateBadgeId, { label: string; className: string }> = {
  recomendado: {
    label: "Recomendado",
    className: "bg-[#c27b3d]/10 text-[#9a5f2e] border-[#c27b3d]/25",
  },
  escolar: {
    label: "Escolar",
    className: "bg-[#f0fdf4] text-[#15803d] border-[#bbf7d0]",
  },
  digital: {
    label: "Digital",
    className: "bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe]",
  },
  premium: {
    label: "Premium",
    className: "bg-[#fafaf9] text-[#57534e] border-[#d6d3d1]",
  },
  "mas-vendido": {
    label: "Más vendido",
    className: "bg-[#fef3c7] text-[#92400e] border-[#fde68a]",
  },
  nuevo: {
    label: "Nuevo",
    className: "bg-[#ecfdf5] text-[#047857] border-[#a7f3d0]",
  },
};

/** IDs de badge editables desde admin CMS. */
export const CATALOG_TEMPLATE_BADGE_IDS: CatalogTemplateBadgeId[] = [
  "recomendado",
  "escolar",
  "digital",
  "premium",
  "mas-vendido",
  "nuevo",
];

export function parseTemplateBadgeIds(raw: unknown): CatalogTemplateBadgeId[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<CatalogTemplateBadgeId>();
  const out: CatalogTemplateBadgeId[] = [];
  for (const item of raw) {
    if (
      typeof item === "string" &&
      CATALOG_TEMPLATE_BADGE_IDS.includes(item as CatalogTemplateBadgeId)
    ) {
      const id = item as CatalogTemplateBadgeId;
      if (!seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
  }
  return out.slice(0, 6);
}

function badgesFromIds(ids: CatalogTemplateBadgeId[]): CatalogTemplateBadge[] {
  return ids.slice(0, 4).map((id) => {
    const style = BADGE_STYLES[id];
    return { id, label: style.label, className: style.className };
  });
}

/** Slugs con badge visual "Más vendido" (fallback si admin no definió badges). */
const BESTSELLER_SLUGS = new Set([
  "pack-fotos-digitales",
  "carpeta-escolar-basica",
  "combo-digital-impresiones",
]);

/** Slugs con badge visual "Nuevo". */
const NEW_SLUGS = new Set([
  "diploma-graduacion-personalizado",
  "stickers-foto-archivo-digital",
  "cuadro-impreso-mdf",
]);

export function resolveTemplateBadges(
  template: Pick<
    SystemCatalogTemplateListItem,
    "slug" | "tags" | "isRecommended" | "name" | "badges"
  >,
  visualCategoryId: VisualCatalogCategoryId
): CatalogTemplateBadge[] {
  const explicit = template.badges?.length ? template.badges : null;
  if (explicit) {
    return badgesFromIds(explicit);
  }

  const badges: CatalogTemplateBadge[] = [];
  const seen = new Set<CatalogTemplateBadgeId>();

  function push(id: CatalogTemplateBadgeId) {
    if (seen.has(id)) return;
    seen.add(id);
    const style = BADGE_STYLES[id];
    badges.push({ id, label: style.label, className: style.className });
  }

  if (template.isRecommended) push("recomendado");
  if (visualCategoryId === "escolar" || template.tags.includes("escolar")) push("escolar");
  if (visualCategoryId === "digitales" || template.tags.includes("digital")) push("digital");
  if (visualCategoryId === "premium" || template.tags.includes("premium")) push("premium");
  if (BESTSELLER_SLUGS.has(template.slug)) push("mas-vendido");
  if (NEW_SLUGS.has(template.slug)) push("nuevo");

  return badges.slice(0, 4);
}
