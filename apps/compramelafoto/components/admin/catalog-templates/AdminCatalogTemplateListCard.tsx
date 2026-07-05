"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";
import CatalogTemplateCover from "@/components/dashboard/catalog-templates/CatalogTemplateCover";
import CatalogTemplateBadgePill from "@/components/dashboard/catalog-templates/CatalogTemplateBadge";
import CatalogTemplateCategoryChip from "@/components/dashboard/catalog-templates/CatalogTemplateCategoryChip";
import type { AdminCatalogTemplateListItem } from "@/lib/catalog-templates/admin-serialize";
import { assessCatalogTemplateReadinessFromBody } from "@/lib/catalog-templates/template-readiness";
import type { EnrichedCatalogTemplate } from "@/lib/catalog-templates/enrich-template-visual";
import { CATALOG_PRODUCT_TYPE_DISPLAY } from "@/lib/catalog-products/catalog-product-visual";

type Props = {
  template: EnrichedCatalogTemplate;
  row: AdminCatalogTemplateListItem;
  toggling?: boolean;
  onToggleActive: () => void;
};

export default function AdminCatalogTemplateListCard({
  template,
  row,
  toggling = false,
  onToggleActive,
}: Props) {
  const primaryBadge = template.badges[0];
  const readiness = assessCatalogTemplateReadinessFromBody({
    name: row.name,
    slug: row.slug,
    description: row.description,
    fullDescription: row.fullDescription,
    visualCategory: row.visualCategory ?? undefined,
    productType: row.productType,
    components: row.components,
    suggestedPriceCents: row.suggestedPriceCents,
    coverImageUrl: row.coverImageUrl,
    coverImageKey: row.coverImageKey,
  });

  return (
    <article className="ds-admin-template-card">
      <Link href={`/admin/catalog-templates/${template.id}`} className="ds-admin-template-card__media">
        <CatalogTemplateCover
          coverUrl={template.coverUrl}
          fallback={template.coverFallback}
          alt={template.name}
          className="rounded-none h-full"
        />
        {primaryBadge ? (
          <div className="ds-admin-template-card__badges">
            <CatalogTemplateBadgePill badge={primaryBadge} />
          </div>
        ) : null}
        {!row.isActive ? (
          <span className="ds-admin-template-card__status ds-admin-template-card__status--inactive">
            Inactivo
          </span>
        ) : row.isRecommended ? (
          <span className="ds-admin-template-card__status ds-admin-template-card__status--recommended">
            ★ Recomendado
          </span>
        ) : null}
      </Link>

      <div className="ds-admin-template-card__body">
        <CatalogTemplateCategoryChip categoryId={template.visualCategoryId} size="sm" />
        <h2 className="ds-admin-template-card__title">
          <Link href={`/admin/catalog-templates/${template.id}`}>{template.name}</Link>
        </h2>
        <p className="ds-admin-template-card__slug">{template.slug}</p>
        <div className="ds-admin-template-card__meta">
          <span className="ds-admin-template-card__meta-chip">
            {CATALOG_PRODUCT_TYPE_DISPLAY[template.productType]}
          </span>
          <span
            className={`ds-admin-template-card__meta-chip ${
              readiness.canActivate ? "text-[#047857]" : "text-[#b91c1c]"
            }`}
          >
            {readiness.canActivate ? "Lista" : "Incompleta"}
          </span>
          <span className="ds-admin-template-card__meta-chip">v{template.version}</span>
          <span className="ds-admin-template-card__meta-chip">#{template.sortOrder}</span>
          <span className="ds-admin-template-card__meta-chip">{row.cloneCount} clones</span>
        </div>
        <div className="ds-admin-template-card__actions">
          <Link href={`/admin/catalog-templates/${template.id}`}>
            <Button type="button" variant="secondary" size="sm" className="w-full">
              Editar
            </Button>
          </Link>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={toggling || (!row.isActive && !readiness.canActivate)}
            title={
              !row.isActive && !readiness.canActivate
                ? "Completá los requisitos en Editar antes de activar"
                : undefined
            }
            onClick={onToggleActive}
          >
            {row.isActive ? "Desactivar" : "Activar"}
          </Button>
        </div>
      </div>
    </article>
  );
}

export function AdminCatalogTemplateGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="ds-admin-template-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="ds-admin-template-skeleton" aria-hidden />
      ))}
    </div>
  );
}
