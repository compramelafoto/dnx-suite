"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import {
  CatalogCardGrid,
  CatalogToolbar,
} from "@/components/dashboard/catalog/CatalogWorkspaceUI";
import CatalogTemplateCard from "@/components/dashboard/catalog-templates/CatalogTemplateCard";
import CatalogTemplateCategoryChip from "@/components/dashboard/catalog-templates/CatalogTemplateCategoryChip";
import CatalogTemplatesGridSkeleton from "@/components/dashboard/catalog-templates/CatalogTemplatesGridSkeleton";
import CatalogTemplatesToast from "@/components/dashboard/catalog-templates/CatalogTemplatesToast";
import type { SystemCatalogTemplateListItem } from "@/lib/catalog-templates/serialize-template";
import {
  countTemplatesByVisualCategory,
  enrichCatalogTemplates,
  filterTemplatesByVisualCategory,
  type EnrichedCatalogTemplate,
} from "@/lib/catalog-templates/enrich-template-visual";
import {
  getVisualCategoryList,
  type VisualCatalogCategoryId,
} from "@/lib/catalog-templates/visual-categories";

type TemplatesResponse = {
  recommended: SystemCatalogTemplateListItem[];
  pendingRecommendedCount: number;
  showRecommendationsBlock: boolean;
};

type CatalogRecommendedTemplatesBlockProps = {
  variant?: "empty" | "inline" | "dedicated";
  alwaysShow?: boolean;
  onCloned?: () => void;
};

type ToastState = { message: string; tone: "success" | "info" } | null;

export default function CatalogRecommendedTemplatesBlock({
  variant = "inline",
  alwaysShow = false,
  onCloned,
}: CatalogRecommendedTemplatesBlockProps) {
  const [data, setData] = useState<TemplatesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [cloningId, setCloningId] = useState<number | null>(null);
  const [cloningAll, setCloningAll] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<VisualCatalogCategoryId | "all">("all");
  const [toast, setToast] = useState<ToastState>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/catalog-templates", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (res.ok) setData(json as TemplatesResponse);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const enriched = useMemo(
    () => enrichCatalogTemplates(data?.recommended ?? []),
    [data?.recommended]
  );

  const categoryCounts = useMemo(() => countTemplatesByVisualCategory(enriched), [enriched]);

  const filtered = useMemo(
    () => filterTemplatesByVisualCategory(enriched, categoryFilter),
    [enriched, categoryFilter]
  );

  const pending = useMemo(() => enriched.filter((t) => !t.alreadyAdded), [enriched]);

  const visibleCategories = useMemo(() => {
    return getVisualCategoryList().filter((c) => (categoryCounts[c.id] ?? 0) > 0);
  }, [categoryCounts]);

  async function cloneOne(id: number) {
    setCloningId(id);
    try {
      const res = await fetch(`/api/dashboard/catalog-templates/${id}/clone`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast({
          tone: "info",
          message: typeof json.error === "string" ? json.error : "No se pudo agregar la plantilla.",
        });
        return;
      }
      setToast({
        tone: json.alreadyExists ? "info" : "success",
        message: json.alreadyExists
          ? ((json.message as string) ?? "Ya estaba en tu catálogo.")
          : "Producto agregado. Podés editar precio, texto e imagen cuando quieras.",
      });
      await load();
      onCloned?.();
    } finally {
      setCloningId(null);
    }
  }

  async function cloneAllRecommended() {
    setCloningAll(true);
    try {
      const res = await fetch("/api/dashboard/catalog-templates/clone-recommended", {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast({
          tone: "info",
          message:
            typeof json.error === "string" ? json.error : "No se pudieron agregar las plantillas.",
        });
        return;
      }
      const added = typeof json.addedCount === "number" ? json.addedCount : 0;
      setToast({
        tone: added > 0 ? "success" : "info",
        message:
          typeof json.message === "string"
            ? json.message
            : added > 0
              ? `Se agregaron ${added} productos a tu catálogo.`
              : "Todas las plantillas ya estaban en tu catálogo.",
      });
      await load();
      onCloned?.();
    } finally {
      setCloningAll(false);
    }
  }

  if (loading) {
    return (
      <div className="w-full min-w-0 ds-catalog-stack">
        <div className="space-y-2 animate-pulse max-w-md">
          <div className="h-3 w-24 rounded bg-[#e5e7eb]" />
          <div className="h-4 w-full max-w-sm rounded bg-[#f3f4f6]" />
        </div>
        <CatalogTemplatesGridSkeleton count={variant === "empty" ? 6 : 3} />
      </div>
    );
  }

  if (!alwaysShow && (!data?.showRecommendationsBlock || enriched.length === 0)) {
    return null;
  }

  if (enriched.length === 0) {
    return (
      <p className="text-sm text-[#6b7280] m-0 py-6 text-center">
        No hay plantillas recomendadas disponibles por ahora.
      </p>
    );
  }

  const showBlockHeader = variant !== "dedicated";
  const shellClass =
    variant === "inline"
      ? "w-full min-w-0 ds-catalog-stack rounded-xl border border-[#e5e7eb] bg-white p-4 sm:p-5"
      : "w-full min-w-0 ds-catalog-stack";

  return (
    <>
      <div className={shellClass}>
        {showBlockHeader ? (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between min-w-0">
            <div className="min-w-0 max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#c27b3d] m-0 mb-1.5">
                Plantillas del sistema
              </p>
              <h2 className="text-lg font-semibold text-[#1a1a1a] m-0 leading-snug">
                {variant === "empty"
                  ? "Comenzá con productos listos para vender"
                  : "Packs y combos recomendados para sumar a tu catálogo"}
              </h2>
              <p className="text-sm text-[#6b7280] mt-2 m-0 leading-relaxed">
                Estas son plantillas del sistema. Al agregarlas, se copian a tu catálogo y después podés
                editarlas sin modificar la plantilla original.
              </p>
            </div>
            {pending.length > 0 ? (
              <Button
                type="button"
                variant="primary"
                size="md"
                className="w-full lg:w-auto shrink-0"
                disabled={cloningAll || cloningId != null}
                onClick={() => void cloneAllRecommended()}
              >
                {cloningAll ? "Agregando…" : `Agregar todos (${pending.length})`}
              </Button>
            ) : null}
          </div>
        ) : null}

        <CatalogToolbar
          meta={
            variant === "dedicated"
              ? "Estas son plantillas del sistema. Al agregarlas, se copian a tu catálogo y después podés editarlas sin modificar la plantilla original."
              : undefined
          }
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
            {visibleCategories.length > 1 ? (
              <div
                className="flex flex-wrap gap-1.5 min-w-0 flex-1"
                role="tablist"
                aria-label="Filtrar plantillas por categoría"
              >
                <CatalogTemplateCategoryChip
                  categoryId="all"
                  count={enriched.length}
                  selected={categoryFilter === "all"}
                  onClick={() => setCategoryFilter("all")}
                  size="sm"
                />
                {visibleCategories.map((cat) => (
                  <CatalogTemplateCategoryChip
                    key={cat.id}
                    categoryId={cat.id}
                    count={categoryCounts[cat.id] ?? 0}
                    selected={categoryFilter === cat.id}
                    onClick={() => setCategoryFilter(cat.id)}
                    size="sm"
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#6b7280] m-0">
                {enriched.length} plantilla{enriched.length === 1 ? "" : "s"} disponibles
              </p>
            )}
            {pending.length > 0 ? (
              <Button
                type="button"
                variant="primary"
                size="md"
                className="w-full sm:w-auto shrink-0"
                disabled={cloningAll || cloningId != null}
                onClick={() => void cloneAllRecommended()}
              >
                {cloningAll ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Agregando {pending.length}…
                  </span>
                ) : (
                  `Agregar todos (${pending.length})`
                )}
              </Button>
            ) : null}
          </div>
        </CatalogToolbar>

        {filtered.length === 0 ? (
          <p className="text-sm text-[#6b7280] m-0 py-6 text-center">
            No hay plantillas en esta categoría. Probá con otra.
          </p>
        ) : (
          <CatalogCardGrid>
            {filtered.map((template: EnrichedCatalogTemplate, index) => (
              <CatalogTemplateCard
                key={template.id}
                template={template}
                cloning={cloningId === template.id}
                onClone={(id) => void cloneOne(id)}
                priorityImage={variant === "empty" && index < 3}
              />
            ))}
          </CatalogCardGrid>
        )}
      </div>

      {toast ? (
        <CatalogTemplatesToast
          message={toast.message}
          tone={toast.tone}
          onDismiss={() => setToast(null)}
        />
      ) : null}
    </>
  );
}
