"use client";

import { useMemo } from "react";
import CatalogTemplateCover from "@/components/dashboard/catalog-templates/CatalogTemplateCover";
import CatalogTemplateBadgePill from "@/components/dashboard/catalog-templates/CatalogTemplateBadge";
import CatalogTemplateCategoryChip from "@/components/dashboard/catalog-templates/CatalogTemplateCategoryChip";
import { enrichCatalogTemplate } from "@/lib/catalog-templates/enrich-template-visual";
import type { AdminCatalogTemplateDetail } from "@/lib/catalog-templates/admin-serialize";
import { CATALOG_PRODUCT_TYPE_DISPLAY } from "@/lib/catalog-products/catalog-product-visual";
import type { CatalogProductType } from "@/lib/prisma";
import type { StoredTemplateComponent } from "@/lib/catalog-templates/template-components";
import type { CatalogTemplateBadgeId } from "@/lib/catalog-templates/template-badges";
import type { VisualCatalogCategoryId } from "@/lib/catalog-templates/visual-categories";
import { getVisualCategory } from "@/lib/catalog-templates/visual-categories";

export type AdminTemplateFormPreviewState = {
  id?: number;
  name: string;
  slug: string;
  description: string;
  visualCategory: VisualCatalogCategoryId;
  productType: CatalogProductType;
  coverImageUrl: string | null;
  suggestedPriceCents: number | null;
  currency: string;
  tags: string[];
  badges: CatalogTemplateBadgeId[];
  isRecommended: boolean;
  components: StoredTemplateComponent[];
};

type Props = {
  state: AdminTemplateFormPreviewState;
};

function formatSuggestedPrice(cents: number | null, currency: string) {
  if (cents == null) return null;
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default function AdminCatalogTemplatePreviewCard({ state }: Props) {
  const enriched = useMemo(() => {
    const categoryLabel = getVisualCategory(state.visualCategory).label;
    return enrichCatalogTemplate({
      id: state.id ?? 0,
      slug: state.slug || "preview",
      name: state.name || "Nuevo template",
      description: state.description || "Descripción corta del producto sugerido.",
      category: categoryLabel,
      visualCategory: state.visualCategory,
      productType: state.productType,
      productTypeLabel: CATALOG_PRODUCT_TYPE_DISPLAY[state.productType],
      coverImageUrl: state.coverImageUrl,
      suggestedPriceCents: state.suggestedPriceCents,
      currency: state.currency,
      tags: state.tags,
      badges: state.badges,
      isRecommended: state.isRecommended,
      sortOrder: 0,
      version: 1,
      componentCount: state.components.length,
      alreadyAdded: false,
      existingProductId: null,
    });
  }, [state]);

  const suggested = formatSuggestedPrice(enriched.suggestedPriceCents, enriched.currency);
  const typeLabel = CATALOG_PRODUCT_TYPE_DISPLAY[enriched.productType as CatalogProductType];

  return (
    <div className="ds-admin-form-section overflow-hidden p-0">
      <div className="px-4 py-2.5 border-b border-[#f3f4f6] bg-[#fafafa]">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-[#9ca3af] m-0">
          Vista previa
        </p>
      </div>
      <div className="p-3 sm:p-4">
        <article className="ds-catalog-card">
          <div className="relative shrink-0">
            <CatalogTemplateCover
              coverUrl={enriched.coverUrl}
              fallback={enriched.coverFallback}
              alt={enriched.name}
            />
            <div className="absolute left-2 top-2 flex flex-wrap gap-1 max-w-[calc(100%-1rem)]">
              {enriched.badges.slice(0, 2).map((b) => (
                <CatalogTemplateBadgePill key={b.id} badge={b} />
              ))}
            </div>
            <span className="absolute bottom-2 right-2 inline-flex rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-medium text-[#6b7280] border border-[#e5e7eb]">
              {typeLabel}
            </span>
          </div>
          <div className="ds-catalog-card__body">
            <div className="min-w-0 space-y-1.5">
              <CatalogTemplateCategoryChip categoryId={enriched.visualCategoryId} size="sm" />
              <h3 className="text-sm font-semibold text-[#1a1a1a] m-0 leading-snug line-clamp-2">
                {enriched.name}
              </h3>
              <p className="text-xs text-[#6b7280] m-0 leading-relaxed line-clamp-2">
                {enriched.description}
              </p>
              {suggested ? (
                <p className="text-xs text-[#374151] m-0">
                  Desde <span className="font-semibold tabular-nums">{suggested}</span>
                </p>
              ) : null}
            </div>
            <div className="ds-catalog-card__footer">
              <div className="w-full rounded-md border border-dashed border-[#e5e7eb] bg-[#fafafa] px-2 py-2 text-center text-[10px] text-[#9ca3af]">
                Preview · card del fotógrafo
              </div>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}

export function adminDetailToPreviewState(
  template: AdminCatalogTemplateDetail
): AdminTemplateFormPreviewState {
  return {
    id: template.id,
    name: template.name,
    slug: template.slug,
    description: template.description,
    visualCategory: template.visualCategory ?? "combos",
    productType: template.productType,
    coverImageUrl: template.coverImageUrl,
    suggestedPriceCents: template.suggestedPriceCents,
    currency: template.currency,
    tags: template.tags,
    badges: template.badges,
    isRecommended: template.isRecommended,
    components: template.components,
  };
}
