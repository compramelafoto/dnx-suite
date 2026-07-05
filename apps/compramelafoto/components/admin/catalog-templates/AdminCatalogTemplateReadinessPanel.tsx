"use client";

import { useMemo } from "react";
import type { CatalogProductType } from "@/lib/prisma";
import {
  assessCatalogTemplateReadinessFromBody,
  type CatalogTemplateReadinessResult,
} from "@/lib/catalog-templates/template-readiness";
import type { StoredTemplateComponent } from "@/lib/catalog-templates/template-components";
import type { VisualCatalogCategoryId } from "@/lib/catalog-templates/visual-categories";

type Props = {
  name: string;
  slug: string;
  description: string;
  fullDescription: string;
  visualCategory: VisualCatalogCategoryId;
  productType: CatalogProductType;
  components: StoredTemplateComponent[];
  suggestedPriceCents: number | null;
  coverImageUrl: string | null;
  coverImageKey: string | null;
  isActive: boolean;
  isRecommended: boolean;
};

function severityClass(severity: "ok" | "warning" | "error"): string {
  switch (severity) {
    case "ok":
      return "text-[#047857]";
    case "warning":
      return "text-[#b45309]";
    case "error":
      return "text-[#b91c1c]";
    default:
      return "text-[#374151]";
  }
}

function statusBanner(result: CatalogTemplateReadinessResult, isPublished: boolean) {
  if (result.canActivate) {
    return {
      className: "border-[#a7f3d0] bg-[#ecfdf5] text-[#047857]",
      title: isPublished ? "Plantilla publicada y usable" : "Lista para activar",
      body: result.headline,
    };
  }
  return {
    className: "border-[#fecaca] bg-[#fef2f2] text-[#991b1b]",
    title: isPublished ? "Plantilla publicada con requisitos pendientes" : "Borrador — no se puede activar",
    body: result.headline,
  };
}

export default function AdminCatalogTemplateReadinessPanel(props: Props) {
  const result = useMemo(
    () =>
      assessCatalogTemplateReadinessFromBody({
        name: props.name,
        slug: props.slug,
        description: props.description,
        fullDescription: props.fullDescription,
        visualCategory: props.visualCategory,
        productType: props.productType,
        components: props.components,
        suggestedPriceCents: props.suggestedPriceCents,
        coverImageUrl: props.coverImageUrl,
        coverImageKey: props.coverImageKey,
      }),
    [props]
  );

  const isPublished = props.isActive || props.isRecommended;
  const banner = statusBanner(result, isPublished);

  return (
    <section className="ds-admin-form-section scroll-mt-4" aria-labelledby="template-readiness-title">
      <div className="ds-admin-form-section__header">
        <h2 id="template-readiness-title" className="ds-admin-form-section__title">
          Diagnóstico de publicación
        </h2>
        <p className="ds-admin-form-section__desc">
          Requisitos mínimos para que fotógrafos puedan clonar la plantilla e importarla a preventa.
        </p>
      </div>
      <div className="ds-admin-form-section__body space-y-3">
        <div className={`rounded-lg border px-4 py-3 ${banner.className}`}>
          <p className="text-sm font-semibold m-0">{banner.title}</p>
          <p className="text-sm m-0 mt-1 opacity-90">{banner.body}</p>
        </div>

        <ul className="m-0 p-0 list-none space-y-2">
          {result.items.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-0.5 rounded-lg border border-[#f1f5f9] bg-[#fafafa] px-3 py-2"
            >
              <span className={`text-sm font-medium ${severityClass(item.severity)}`}>
                {item.severity === "ok" ? "✓" : item.severity === "warning" ? "!" : "✕"} {item.title}
              </span>
              {item.detail ? (
                <span className="text-xs text-[#6b7280]">{item.detail}</span>
              ) : null}
            </li>
          ))}
        </ul>

        {!result.canActivate && (props.isActive || props.isRecommended) ? (
          <p className="text-xs text-[#b91c1c] m-0">
            Desactivá &quot;Activo&quot; y &quot;Recomendado&quot; para guardar como borrador, o completá los
            requisitos marcados en rojo.
          </p>
        ) : null}
      </div>
    </section>
  );
}

export function useCatalogTemplateReadiness(props: Omit<Props, "isActive" | "isRecommended">) {
  return useMemo(
    () =>
      assessCatalogTemplateReadinessFromBody({
        name: props.name,
        slug: props.slug,
        description: props.description,
        fullDescription: props.fullDescription,
        visualCategory: props.visualCategory,
        productType: props.productType,
        components: props.components,
        suggestedPriceCents: props.suggestedPriceCents,
        coverImageUrl: props.coverImageUrl,
        coverImageKey: props.coverImageKey,
      }),
    [props]
  );
}
