import type { CatalogProductType } from "@/lib/prisma";
import {
  parseComponentsPayload,
  validateComponentsForProductType,
} from "@/lib/catalog-products/components";
import {
  CATALOG_TEMPLATE_BADGE_IDS,
  type CatalogTemplateBadgeId,
} from "@/lib/catalog-templates/template-badges";
import type { StoredTemplateComponent } from "@/lib/catalog-templates/template-components";
import {
  getVisualCategory,
  VISUAL_CATALOG_CATEGORY_IDS,
  type VisualCatalogCategoryId,
} from "@/lib/catalog-templates/visual-categories";
import { slugifyTemplateName } from "@/lib/catalog-templates/slugify-template";
import { ADMIN_TEMPLATE_COLLECTION_OPTIONS } from "@/lib/catalog-templates/admin-serialize";

const PRODUCT_TYPES: CatalogProductType[] = ["SIMPLE", "PACK", "COMBO"];

export type AdminTemplateInput = {
  name: string;
  slug: string;
  description: string;
  fullDescription: string;
  visualCategory: VisualCatalogCategoryId;
  productType: CatalogProductType;
  tags: string[];
  badges: CatalogTemplateBadgeId[];
  components: StoredTemplateComponent[];
  isActive: boolean;
  isRecommended: boolean;
  featured: boolean;
  collection: string | null;
  editableByPhotographer: boolean;
  sortOrder: number;
  version: number;
  suggestedPriceCents: number | null;
  currency: string;
  coverImageUrl: string | null;
  coverImageKey: string | null;
  bumpVersion: boolean;
};

export function parseAdminTemplateBody(raw: unknown): { ok: true; data: AdminTemplateInput } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Datos inválidos." };
  }
  const body = raw as Record<string, unknown>;

  const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
  if (name.length < 2) return { ok: false, error: "El nombre debe tener al menos 2 caracteres." };

  let slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
  if (!slug) slug = slugifyTemplateName(name);
  slug = slug.replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
  if (!slug) return { ok: false, error: "Slug inválido." };

  const visualRaw = typeof body.visualCategory === "string" ? body.visualCategory.trim() : "";
  if (!VISUAL_CATALOG_CATEGORY_IDS.includes(visualRaw as VisualCatalogCategoryId)) {
    return { ok: false, error: "Elegí una categoría visual válida." };
  }
  const visualCategory = visualRaw as VisualCatalogCategoryId;

  const typeRaw = typeof body.productType === "string" ? body.productType.toUpperCase() : "";
  if (!PRODUCT_TYPES.includes(typeRaw as CatalogProductType)) {
    return { ok: false, error: "Tipo de producto inválido." };
  }
  const productType = typeRaw as CatalogProductType;

  const description = typeof body.description === "string" ? body.description.trim().slice(0, 500) : "";
  const fullDescription =
    typeof body.fullDescription === "string" ? body.fullDescription.trim().slice(0, 5000) : "";

  const tags = Array.isArray(body.tags)
    ? body.tags
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.trim().slice(0, 40))
        .filter(Boolean)
        .slice(0, 20)
    : [];

  const badges = Array.isArray(body.badges)
    ? body.badges
        .filter((b): b is CatalogTemplateBadgeId =>
          typeof b === "string" && CATALOG_TEMPLATE_BADGE_IDS.includes(b as CatalogTemplateBadgeId)
        )
        .slice(0, 6)
    : [];

  const componentsParsed = parseComponentsPayload(body.components);
  if (typeof componentsParsed === "string") {
    return { ok: false, error: componentsParsed };
  }
  const components: StoredTemplateComponent[] = componentsParsed.map((c, i) => ({
    name: c.name,
    quantity: c.quantity,
    deliveryType: c.deliveryType,
    sortOrder: i,
    notes: c.notes,
    digitalQuantityMode: c.digitalQuantityMode,
  }));

  const typeError = validateComponentsForProductType(productType, componentsParsed);
  if (typeError) return { ok: false, error: typeError };

  const priceRaw = body.suggestedPriceCents;
  let suggestedPriceCents: number | null = null;
  if (priceRaw != null && priceRaw !== "") {
    const n = typeof priceRaw === "number" ? priceRaw : parseInt(String(priceRaw), 10);
    if (!Number.isFinite(n) || n < 0) return { ok: false, error: "Precio sugerido inválido." };
    suggestedPriceCents = n === 0 ? null : Math.round(n);
  }

  const currency = typeof body.currency === "string" && body.currency.trim() ? body.currency.trim().slice(0, 8) : "ARS";

  const collectionRaw = typeof body.collection === "string" ? body.collection.trim() : "";
  const collection =
    collectionRaw && ADMIN_TEMPLATE_COLLECTION_OPTIONS.some((c) => c.id === collectionRaw)
      ? collectionRaw
      : null;

  const sortOrder =
    typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)
      ? Math.round(body.sortOrder)
      : parseInt(String(body.sortOrder ?? "0"), 10) || 0;

  const version =
    typeof body.version === "number" && Number.isFinite(body.version)
      ? Math.max(1, Math.round(body.version))
      : parseInt(String(body.version ?? "1"), 10) || 1;

  return {
    ok: true,
    data: {
      name,
      slug,
      description,
      fullDescription,
      visualCategory,
      productType,
      tags,
      badges,
      components,
      isActive: body.isActive !== false,
      isRecommended: body.isRecommended !== false,
      featured: body.featured === true,
      collection,
      editableByPhotographer: body.editableByPhotographer !== false,
      sortOrder,
      version,
      suggestedPriceCents,
      currency,
      coverImageUrl:
        typeof body.coverImageUrl === "string" && body.coverImageUrl.trim()
          ? body.coverImageUrl.trim()
          : null,
      coverImageKey:
        typeof body.coverImageKey === "string" && body.coverImageKey.trim()
          ? body.coverImageKey.trim()
          : null,
      bumpVersion: body.bumpVersion === true,
    },
  };
}

export function adminInputToDbFields(input: AdminTemplateInput, currentVersion?: number) {
  const category = getVisualCategory(input.visualCategory).label;
  return {
    name: input.name,
    slug: input.slug,
    description: input.description,
    fullDescription: input.fullDescription,
    category,
    visualCategory: input.visualCategory,
    productType: input.productType,
    tags: input.tags,
    badges: input.badges,
    components: input.components.map((c) => ({
      name: c.name,
      quantity: c.quantity,
      deliveryType: c.deliveryType,
      sortOrder: c.sortOrder,
      notes: c.notes ?? "",
      ...(c.digitalQuantityMode && c.digitalQuantityMode !== "FIXED"
        ? { digitalQuantityMode: c.digitalQuantityMode }
        : {}),
    })),
    isActive: input.isActive,
    isRecommended: input.isRecommended,
    featured: input.featured,
    collection: input.collection,
    editableByPhotographer: input.editableByPhotographer,
    sortOrder: input.sortOrder,
    suggestedPriceCents: input.suggestedPriceCents,
    currency: input.currency,
    coverImageUrl: input.coverImageUrl,
    coverImageKey: input.coverImageKey,
    version: input.bumpVersion ? (currentVersion ?? input.version) + 1 : input.version,
  };
}
