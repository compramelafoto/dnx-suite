"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";
import CatalogTemplateCover from "@/components/dashboard/catalog-templates/CatalogTemplateCover";
import CatalogTemplateBadgePill from "@/components/dashboard/catalog-templates/CatalogTemplateBadge";
import CatalogTemplateCategoryChip from "@/components/dashboard/catalog-templates/CatalogTemplateCategoryChip";
import type { EnrichedCatalogTemplate } from "@/lib/catalog-templates/enrich-template-visual";
import { CATALOG_PRODUCT_TYPE_DISPLAY } from "@/lib/catalog-products/catalog-product-visual";
import type { CatalogProductType } from "@/lib/prisma";

type CatalogTemplateCardProps = {
  template: EnrichedCatalogTemplate;
  cloning?: boolean;
  onClone: (id: number) => void;
  priorityImage?: boolean;
};

function formatSuggestedPrice(cents: number | null, currency: string) {
  if (cents == null) return null;
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default function CatalogTemplateCard({
  template,
  cloning = false,
  onClone,
  priorityImage = false,
}: CatalogTemplateCardProps) {
  const suggested = formatSuggestedPrice(template.suggestedPriceCents, template.currency);
  const typeLabel = CATALOG_PRODUCT_TYPE_DISPLAY[template.productType as CatalogProductType];

  return (
    <article className="ds-catalog-card group">
      <div className="relative shrink-0">
        <CatalogTemplateCover
          coverUrl={template.coverUrl}
          fallback={template.coverFallback}
          alt={template.name}
          priority={priorityImage}
        />
        <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1 max-w-[calc(100%-1.25rem)]">
          {template.badges.slice(0, 2).map((b) => (
            <CatalogTemplateBadgePill key={b.id} badge={b} />
          ))}
        </div>
        <span className="absolute bottom-2.5 right-2.5 inline-flex rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-medium text-[#6b7280] border border-[#e5e7eb] backdrop-blur-sm">
          {typeLabel}
        </span>
      </div>

      <div className="ds-catalog-card__body">
        <div className="min-w-0 space-y-2">
          <CatalogTemplateCategoryChip categoryId={template.visualCategoryId} size="sm" />
          <h3 className="text-base font-semibold text-[#1a1a1a] m-0 leading-snug line-clamp-2">
            {template.name}
          </h3>
          <p className="text-sm text-[#6b7280] m-0 leading-relaxed line-clamp-2">
            {template.description}
          </p>
          {template.badges.length > 2 ? (
            <div className="flex flex-wrap gap-1">
              {template.badges.slice(2).map((b) => (
                <CatalogTemplateBadgePill key={b.id} badge={b} />
              ))}
            </div>
          ) : null}
          {suggested ? (
            <p className="text-sm text-[#374151] m-0 pt-0.5">
              Desde <span className="font-semibold tabular-nums">{suggested}</span>
            </p>
          ) : null}
        </div>

        <div className="ds-catalog-card__footer">
          {template.alreadyAdded && template.existingProductId ? (
            <div className="space-y-1.5">
              <Link href={`/dashboard/productos/${template.existingProductId}`} className="block w-full">
                <Button type="button" variant="secondary" size="md" className="w-full">
                  Editar en mi catálogo
                </Button>
              </Link>
              <p className="text-xs text-center text-[#16a34a] m-0 font-medium">Ya agregado</p>
            </div>
          ) : (
            <Button
              type="button"
              variant="primary"
              size="md"
              className="w-full"
              disabled={cloning}
              onClick={() => onClone(template.id)}
            >
              {cloning ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Agregando…
                </span>
              ) : (
                "Agregar a mi catálogo"
              )}
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
