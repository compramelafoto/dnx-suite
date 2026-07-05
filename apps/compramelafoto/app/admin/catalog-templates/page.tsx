"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { DsEmptyState } from "@/components/ui/DsEmptyState";
import AdminCatalogTemplateShell from "@/components/admin/catalog-templates/AdminCatalogTemplateShell";
import AdminCatalogTemplateListCard, {
  AdminCatalogTemplateGridSkeleton,
} from "@/components/admin/catalog-templates/AdminCatalogTemplateListCard";
import {
  CatalogStatusPills,
  CatalogToolbar,
} from "@/components/dashboard/catalog/CatalogWorkspaceUI";
import type { AdminCatalogTemplateListItem } from "@/lib/catalog-templates/admin-serialize";
import { enrichCatalogTemplate } from "@/lib/catalog-templates/enrich-template-visual";
import { getVisualCategoryList } from "@/lib/catalog-templates/visual-categories";

const categories = getVisualCategoryList();

const ACTIVE_TABS = [
  { id: "all", label: "Todos" },
  { id: "true", label: "Activos" },
  { id: "false", label: "Inactivos" },
] as const;

const RECOMMENDED_TABS = [
  { id: "all", label: "Todos" },
  { id: "true", label: "Recomendados" },
  { id: "false", label: "Sin destacar" },
] as const;

function adminRowToListItem(row: AdminCatalogTemplateListItem) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    category: row.category,
    visualCategory: row.visualCategory,
    productType: row.productType,
    productTypeLabel: row.productTypeLabel,
    coverImageUrl: row.coverImageUrl,
    suggestedPriceCents: row.suggestedPriceCents,
    currency: row.currency,
    tags: row.tags,
    badges: row.badges,
    isRecommended: row.isRecommended,
    sortOrder: row.sortOrder,
    version: row.version,
    componentCount: row.componentCount,
    alreadyAdded: false,
    existingProductId: null,
  };
}

export default function AdminCatalogTemplatesPage() {
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<AdminCatalogTemplateListItem[]>([]);
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [active, setActive] = useState<(typeof ACTIVE_TABS)[number]["id"]>("all");
  const [recommended, setRecommended] =
    useState<(typeof RECOMMENDED_TABS)[number]["id"]>("all");
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setQ(qInput.trim()), 280);
    return () => window.clearTimeout(t);
  }, [qInput]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (category !== "all") params.set("category", category);
      if (active !== "all") params.set("active", active);
      if (recommended !== "all") params.set("recommended", recommended);
      const res = await fetch(`/api/admin/catalog-templates?${params}`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();
      setTemplates(Array.isArray(data.templates) ? data.templates : []);
    } finally {
      setLoading(false);
    }
  }, [q, category, active, recommended]);

  useEffect(() => {
    void load();
  }, [load]);

  const enriched = useMemo(
    () => templates.map((t) => enrichCatalogTemplate(adminRowToListItem(t))),
    [templates]
  );

  const hasFilters =
    q.length > 0 || category !== "all" || active !== "all" || recommended !== "all";

  async function toggleActive(template: AdminCatalogTemplateListItem) {
    setTogglingId(template.id);
    setToggleError(null);
    try {
      const res = await fetch(`/api/admin/catalog-templates/${template.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...templatePayloadFromRow(template),
          isActive: !template.isActive,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToggleError(
          typeof data.error === "string"
            ? data.error
            : "No se pudo cambiar el estado de la plantilla."
        );
        return;
      }
      void load();
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <AdminCatalogTemplateShell
      title="Templates del sistema"
      subtitle="Productos sugeridos para fotógrafos. Los cambios acá no modifican catálogos ya clonados."
      actions={
        <Link href="/admin/catalog-templates/new" className="w-full sm:w-auto">
          <Button variant="primary" className="w-full sm:w-auto">
            Nuevo template
          </Button>
        </Link>
      }
    >
      <CatalogToolbar
        meta={
          loading
            ? "Cargando…"
            : `${templates.length} template${templates.length === 1 ? "" : "s"}`
        }
      >
        <CatalogStatusPills
          tabs={[...ACTIVE_TABS]}
          activeId={active}
          onChange={setActive}
          ariaLabel="Filtrar por estado"
        />
        <CatalogStatusPills
          tabs={[...RECOMMENDED_TABS]}
          activeId={recommended}
          onChange={setRecommended}
          ariaLabel="Filtrar por recomendados"
        />
        <div className="ds-admin-toolbar-filters">
          <div className="ds-catalog-toolbar__field">
            <label htmlFor="admin-tpl-search">Buscar</label>
            <Input
              id="admin-tpl-search"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Nombre o slug…"
            />
          </div>
          <div className="ds-catalog-toolbar__field">
            <label htmlFor="admin-tpl-category">Categoría</label>
            <Select
              id="admin-tpl-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="all">Todas</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </CatalogToolbar>

      {toggleError ? (
        <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#b91c1c] mb-4">
          {toggleError}
        </div>
      ) : null}

      {loading ? (
        <AdminCatalogTemplateGridSkeleton />
      ) : enriched.length === 0 ? (
        <div className="ds-admin-form-section">
          <DsEmptyState
            title={hasFilters ? "Sin resultados" : "Todavía no hay templates"}
            variant="tight"
          >
            {hasFilters ? (
              <p className="text-sm text-[#6b7280] m-0">
                Probá otros filtros o limpiá la búsqueda.
              </p>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <p className="text-sm text-[#6b7280] m-0">
                  Creá el primer producto sugerido para que los fotógrafos lo clonen.
                </p>
                <Link href="/admin/catalog-templates/new">
                  <Button variant="primary">
                    Crear template
                  </Button>
                </Link>
              </div>
            )}
          </DsEmptyState>
        </div>
      ) : (
        <div className="ds-admin-template-grid">
          {enriched.map((t) => {
            const row = templates.find((r) => r.id === t.id)!;
            return (
              <AdminCatalogTemplateListCard
                key={t.id}
                template={t}
                row={row}
                toggling={togglingId === t.id}
                onToggleActive={() => void toggleActive(row)}
              />
            );
          })}
        </div>
      )}
    </AdminCatalogTemplateShell>
  );
}

function templatePayloadFromRow(row: AdminCatalogTemplateListItem) {
  return {
    name: row.name,
    slug: row.slug,
    description: row.description,
    fullDescription: row.fullDescription,
    visualCategory: row.visualCategory ?? "combos",
    productType: row.productType,
    tags: row.tags,
    badges: row.badges,
    components: row.components,
    isActive: row.isActive,
    isRecommended: row.isRecommended,
    featured: row.featured,
    collection: row.collection,
    editableByPhotographer: row.editableByPhotographer,
    sortOrder: row.sortOrder,
    version: row.version,
    suggestedPriceCents: row.suggestedPriceCents,
    currency: row.currency,
    coverImageUrl: row.coverImageUrl,
    coverImageKey: row.coverImageKey,
  };
}
