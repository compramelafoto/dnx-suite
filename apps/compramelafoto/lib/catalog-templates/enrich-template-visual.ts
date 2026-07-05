import type { SystemCatalogTemplateListItem } from "@/lib/catalog-templates/serialize-template";
import {
  getVisualCategory,
  resolveVisualCategory,
  type VisualCatalogCategoryId,
} from "@/lib/catalog-templates/visual-categories";
import {
  buildTemplateCoverFallback,
  resolveTemplateCoverUrl,
} from "@/lib/catalog-templates/template-covers";
import {
  resolveTemplateBadges,
  type CatalogTemplateBadge,
} from "@/lib/catalog-templates/template-badges";

export type EnrichedCatalogTemplate = Omit<SystemCatalogTemplateListItem, "badges"> & {
  visualCategoryId: VisualCatalogCategoryId;
  visualCategoryLabel: string;
  coverUrl: string | null;
  coverFallback: ReturnType<typeof buildTemplateCoverFallback>;
  badges: CatalogTemplateBadge[];
};

export function enrichCatalogTemplate(
  template: SystemCatalogTemplateListItem
): EnrichedCatalogTemplate {
  const visualCategoryId = resolveVisualCategory({
    slug: template.slug,
    category: template.category,
    tags: template.tags,
    visualCategory: template.visualCategory,
  });
  const visualCategory = getVisualCategory(visualCategoryId);
  const coverUrl = resolveTemplateCoverUrl({
    slug: template.slug,
    coverImageUrl: template.coverImageUrl,
  });

  return {
    ...template,
    visualCategoryId,
    visualCategoryLabel: visualCategory.label,
    coverUrl,
    coverFallback: buildTemplateCoverFallback({
      name: template.name,
      visualCategoryId,
    }),
    badges: resolveTemplateBadges(template, visualCategoryId),
  };
}

export function enrichCatalogTemplates(
  templates: SystemCatalogTemplateListItem[]
): EnrichedCatalogTemplate[] {
  return templates.map(enrichCatalogTemplate);
}

export function filterTemplatesByVisualCategory(
  templates: EnrichedCatalogTemplate[],
  categoryId: VisualCatalogCategoryId | "all"
): EnrichedCatalogTemplate[] {
  if (categoryId === "all") return templates;
  return templates.filter((t) => t.visualCategoryId === categoryId);
}

export function countTemplatesByVisualCategory(
  templates: EnrichedCatalogTemplate[]
): Partial<Record<VisualCatalogCategoryId, number>> {
  const counts: Partial<Record<VisualCatalogCategoryId, number>> = {};
  for (const t of templates) {
    counts[t.visualCategoryId] = (counts[t.visualCategoryId] ?? 0) + 1;
  }
  return counts;
}
