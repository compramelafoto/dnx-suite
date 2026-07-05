import type { CatalogProductType, SystemCatalogTemplate } from "@/lib/prisma";
import { parseTemplateComponents } from "@/lib/catalog-templates/template-components";
import {
  parseTemplateBadgeIds,
  type CatalogTemplateBadgeId,
} from "@/lib/catalog-templates/template-badges";
import { CATALOG_PRODUCT_TYPE_DISPLAY } from "@/lib/catalog-products/catalog-product-visual";

export type SystemCatalogTemplateListItem = {
  id: number;
  slug: string;
  name: string;
  description: string;
  category: string;
  visualCategory: string | null;
  productType: CatalogProductType;
  productTypeLabel: string;
  coverImageUrl: string | null;
  suggestedPriceCents: number | null;
  currency: string;
  tags: string[];
  badges: CatalogTemplateBadgeId[];
  isRecommended: boolean;
  sortOrder: number;
  version: number;
  componentCount: number;
  alreadyAdded: boolean;
  existingProductId: number | null;
};

export function serializeSystemCatalogTemplate(
  template: SystemCatalogTemplate,
  clonedByUser: { productId: number } | null
): SystemCatalogTemplateListItem {
  const tags = Array.isArray(template.tags)
    ? template.tags.filter((t): t is string => typeof t === "string")
    : [];
  const components = parseTemplateComponents(template.components);

  return {
    id: template.id,
    slug: template.slug,
    name: template.name,
    description: template.description,
    category: template.category,
    visualCategory: template.visualCategory,
    productType: template.productType,
    productTypeLabel: CATALOG_PRODUCT_TYPE_DISPLAY[template.productType],
    coverImageUrl: template.coverImageUrl,
    suggestedPriceCents: template.suggestedPriceCents,
    currency: template.currency,
    tags,
    badges: parseTemplateBadgeIds(template.badges),
    isRecommended: template.isRecommended,
    sortOrder: template.sortOrder,
    version: template.version,
    componentCount: components.length,
    alreadyAdded: clonedByUser != null,
    existingProductId: clonedByUser?.productId ?? null,
  };
}
