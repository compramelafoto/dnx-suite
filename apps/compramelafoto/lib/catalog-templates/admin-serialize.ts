import type { CatalogProductType, SystemCatalogTemplate } from "@/lib/prisma";
import { parseTemplateComponents } from "@/lib/catalog-templates/template-components";
import {
  CATALOG_TEMPLATE_BADGE_IDS,
  type CatalogTemplateBadgeId,
  parseTemplateBadgeIds,
} from "@/lib/catalog-templates/template-badges";
import {
  getVisualCategory,
  VISUAL_CATALOG_CATEGORY_IDS,
  type VisualCatalogCategoryId,
} from "@/lib/catalog-templates/visual-categories";
import { CATALOG_PRODUCT_TYPE_DISPLAY } from "@/lib/catalog-products/catalog-product-visual";
import { CATALOG_TEMPLATE_COLLECTIONS } from "@/lib/catalog-templates/template-collections";

export type AdminCatalogTemplateDetail = {
  id: number;
  name: string;
  slug: string;
  description: string;
  fullDescription: string;
  category: string;
  visualCategory: VisualCatalogCategoryId | null;
  productType: CatalogProductType;
  productTypeLabel: string;
  coverImageUrl: string | null;
  coverImageKey: string | null;
  suggestedPriceCents: number | null;
  currency: string;
  tags: string[];
  badges: CatalogTemplateBadgeId[];
  components: ReturnType<typeof parseTemplateComponents>;
  isActive: boolean;
  isRecommended: boolean;
  featured: boolean;
  collection: string | null;
  editableByPhotographer: boolean;
  sortOrder: number;
  version: number;
  cloneCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminCatalogTemplateListItem = AdminCatalogTemplateDetail & {
  componentCount: number;
};

function parseTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((t): t is string => typeof t === "string").map((t) => t.trim()).filter(Boolean);
}

function parseVisualCategory(raw: string | null | undefined): VisualCatalogCategoryId | null {
  if (!raw) return null;
  return VISUAL_CATALOG_CATEGORY_IDS.includes(raw as VisualCatalogCategoryId)
    ? (raw as VisualCatalogCategoryId)
    : null;
}

export function serializeAdminCatalogTemplate(
  row: SystemCatalogTemplate & { _count?: { clonedProducts: number } }
): AdminCatalogTemplateListItem {
  const components = parseTemplateComponents(row.components);
  const visualCategory = parseVisualCategory(row.visualCategory);
  const categoryLabel = visualCategory
    ? getVisualCategory(visualCategory).label
    : row.category;

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    fullDescription: row.fullDescription,
    category: categoryLabel,
    visualCategory,
    productType: row.productType,
    productTypeLabel: CATALOG_PRODUCT_TYPE_DISPLAY[row.productType],
    coverImageUrl: row.coverImageUrl,
    coverImageKey: row.coverImageKey,
    suggestedPriceCents: row.suggestedPriceCents,
    currency: row.currency,
    tags: parseTags(row.tags),
    badges: parseTemplateBadgeIds(row.badges),
    components,
    componentCount: components.length,
    isActive: row.isActive,
    isRecommended: row.isRecommended,
    featured: row.featured,
    collection: row.collection,
    editableByPhotographer: row.editableByPhotographer,
    sortOrder: row.sortOrder,
    version: row.version,
    cloneCount: row._count?.clonedProducts ?? 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const ADMIN_TEMPLATE_COLLECTION_OPTIONS = CATALOG_TEMPLATE_COLLECTIONS.map((c) => ({
  id: c.id,
  label: c.label,
}));

export const ADMIN_TEMPLATE_BADGE_OPTIONS = CATALOG_TEMPLATE_BADGE_IDS.map((id) => ({
  id,
  label:
    id === "mas-vendido"
      ? "Más vendido"
      : id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, " "),
}));
