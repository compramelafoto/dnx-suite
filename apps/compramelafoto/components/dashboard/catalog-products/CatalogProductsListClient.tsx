"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import PhotographerDashboardHeader from "@/components/photographer/PhotographerDashboardHeader";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { DsCatalogShell } from "@/components/ui/DsLayout";
import {
  CatalogCardGrid,
  CatalogPageHeader,
  CatalogSegmentTabs,
  CatalogStatusPills,
  CatalogToolbar,
  CatalogWorkspaceSection,
} from "@/components/dashboard/catalog/CatalogWorkspaceUI";
import CatalogPhase1Notice from "@/components/dashboard/catalog-products/CatalogPhase1Notice";
import CatalogProductsEmptyState from "@/components/dashboard/catalog-products/CatalogProductsEmptyState";
import CatalogProductsListEmptyMessage from "@/components/dashboard/catalog-products/CatalogProductsListEmptyMessage";
import CatalogProductCard from "@/components/dashboard/catalog-products/CatalogProductCard";
import CatalogRecommendedTemplatesBlock from "@/components/dashboard/catalog-products/CatalogRecommendedTemplatesBlock";
import type { CatalogProductListItem } from "@/lib/catalog-products/serialize";
import { CATALOG_PRODUCT_TYPE_DISPLAY } from "@/lib/catalog-products/catalog-product-visual";
import type { CatalogProductType } from "@/lib/prisma";

type ProductStatusId = "all" | "active" | "archived";
type PageTabId = "mis-productos" | "recomendados";

type CategoryRow = { id: number; name: string };

function parseProductStatus(rawView: string | null, rawStatus: string | null): ProductStatusId {
  if (rawStatus && ["all", "active", "archived"].includes(rawStatus)) {
    return rawStatus as ProductStatusId;
  }
  if (rawView && ["all", "active", "archived"].includes(rawView)) {
    return rawView as ProductStatusId;
  }
  return "all";
}

export default function CatalogProductsListClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templatesAnchorRef = useRef<HTMLDivElement>(null);

  const rawView = searchParams.get("view");
  const isRecomendadosPage = rawView === "recomendados";
  const pageTab: PageTabId = isRecomendadosPage ? "recomendados" : "mis-productos";
  const productStatus = parseProductStatus(rawView, searchParams.get("status"));

  const [products, setProducts] = useState<CatalogProductListItem[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [counts, setCounts] = useState({ all: 0, active: 0, archived: 0, shown: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (isRecomendadosPage && !loading) {
      templatesAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [isRecomendadosPage, loading]);

  const loadCategories = useCallback(async () => {
    const res = await fetch("/api/dashboard/catalog-product-categories", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setCategories(
      Array.isArray(data.categories)
        ? data.categories.map((c: { id: number; name: string }) => ({ id: c.id, name: c.name }))
        : []
    );
  }, []);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ view: productStatus });
      if (qDebounced) params.set("q", qDebounced);
      if (categoryFilter) params.set("categoryId", categoryFilter);
      if (typeFilter) params.set("type", typeFilter);
      const res = await fetch(`/api/dashboard/catalog-products?${params}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Error al cargar");
      }
      setProducts(Array.isArray(data.products) ? data.products : []);
      if (data.counts) setCounts(data.counts);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al cargar productos");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [productStatus, qDebounced, categoryFilter, typeFilter]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  function setPageTab(next: PageTabId) {
    if (next === "recomendados") {
      router.push("/dashboard/productos?view=recomendados");
      return;
    }
    const params = new URLSearchParams();
    if (productStatus !== "all") params.set("status", productStatus);
    const qs = params.toString();
    router.push(qs ? `/dashboard/productos?${qs}` : "/dashboard/productos");
  }

  function setProductStatus(next: ProductStatusId) {
    const params = new URLSearchParams();
    if (next !== "all") params.set("status", next);
    const qs = params.toString();
    router.push(qs ? `/dashboard/productos?${qs}` : "/dashboard/productos");
  }

  async function patchProduct(id: number, body: Record<string, unknown>) {
    const res = await fetch(`/api/dashboard/catalog-products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(typeof data.error === "string" ? data.error : "Error");
      return false;
    }
    await loadProducts();
    return true;
  }

  async function duplicateProduct(id: number) {
    const res = await fetch(`/api/dashboard/catalog-products/${id}/duplicate`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(typeof data.error === "string" ? data.error : "No se pudo duplicar");
      return;
    }
    router.push(`/dashboard/productos/${data.id}`);
  }

  const statusTabs = useMemo(
    () =>
      [
        { id: "all" as const, label: "Todos", count: counts.all },
        { id: "active" as const, label: "Activos", count: counts.active },
        { id: "archived" as const, label: "Archivados", count: counts.archived },
      ] satisfies { id: ProductStatusId; label: string; count: number }[],
    [counts]
  );

  const pageTabs = useMemo(
    () =>
      [
        { id: "mis-productos" as const, label: "Mis Packs y Combos" },
        { id: "recomendados" as const, label: "Recomendados del sistema" },
      ] satisfies { id: PageTabId; label: string }[],
    []
  );

  const hasActiveFilters = Boolean(qDebounced || categoryFilter || typeFilter);
  const showInspirationalEmpty =
    pageTab === "mis-productos" && !loading && !error && counts.all === 0 && productStatus !== "archived";

  const headerActions =
    pageTab === "mis-productos" ? (
      <>
        <Link href="/dashboard/productos/categorias" className="w-full sm:w-auto">
          <Button type="button" variant="secondary" size="md" className="w-full sm:w-auto whitespace-nowrap">
            Categorías
          </Button>
        </Link>
        <Link href="/dashboard/productos/nuevo" className="w-full sm:w-auto">
          <Button type="button" variant="primary" size="md" className="w-full sm:w-auto whitespace-nowrap">
            + Crear producto
          </Button>
        </Link>
      </>
    ) : null;

  return (
    <>
      <PhotographerDashboardHeader photographer={null} />
      <CatalogWorkspaceSection>
        <DsCatalogShell>
          <div className="ds-catalog-stack">
            <CatalogPageHeader
              title={pageTab === "recomendados" ? "Packs y Combos Recomendados" : "Mis Packs y Combos"}
              subtitle={
                pageTab === "recomendados"
                  ? "Plantillas del sistema para arrancar rápido. Al agregarlas, se copian a tu catálogo y podés editarlas libremente."
                  : "Creá y organizá los packs, combos y productos que después vas a poder activar en tus álbumes."
              }
              actions={headerActions}
            />

            <CatalogSegmentTabs
              tabs={pageTabs}
              activeId={pageTab}
              onChange={setPageTab}
              ariaLabel="Sección de packs y combos"
            />

            {pageTab === "recomendados" ? (
              <div ref={templatesAnchorRef} className="scroll-mt-4 w-full min-w-0">
                <CatalogRecommendedTemplatesBlock
                  variant="dedicated"
                  alwaysShow
                  onCloned={loadProducts}
                />
              </div>
            ) : (
              <>
                {!showInspirationalEmpty ? <CatalogPhase1Notice /> : null}

                {!showInspirationalEmpty ? (
                  <CatalogToolbar
                    meta={`Mostrando ${counts.shown} producto${counts.shown === 1 ? "" : "s"} propios`}
                  >
                    <CatalogStatusPills
                      tabs={statusTabs}
                      activeId={productStatus}
                      onChange={setProductStatus}
                      ariaLabel="Estado de productos"
                    />
                    <div className="ds-catalog-toolbar__filters">
                      <div className="ds-catalog-toolbar__field min-w-0">
                        <label htmlFor="catalog-product-search">Buscar</label>
                        <Input
                          id="catalog-product-search"
                          value={q}
                          onChange={(e) => setQ(e.target.value)}
                          placeholder="Nombre o descripción…"
                          className="w-full min-w-0"
                        />
                      </div>
                      <div className="ds-catalog-toolbar__field min-w-0">
                        <label htmlFor="catalog-product-category">Categoría</label>
                        <Select
                          id="catalog-product-category"
                          value={categoryFilter}
                          onChange={(e) => setCategoryFilter(e.target.value)}
                          className="w-full min-w-0"
                        >
                          <option value="">Todas</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="ds-catalog-toolbar__field min-w-0">
                        <label htmlFor="catalog-product-type">Tipo</label>
                        <Select
                          id="catalog-product-type"
                          value={typeFilter}
                          onChange={(e) => setTypeFilter(e.target.value)}
                          className="w-full min-w-0"
                        >
                          <option value="">Todos</option>
                          {(Object.keys(CATALOG_PRODUCT_TYPE_DISPLAY) as CatalogProductType[]).map((t) => (
                            <option key={t} value={t}>
                              {CATALOG_PRODUCT_TYPE_DISPLAY[t]}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </div>
                  </CatalogToolbar>
                ) : null}

                {error ? (
                  <p className="text-sm text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] rounded-lg px-3 py-2 m-0">
                    {error}
                  </p>
                ) : null}

                {loading ? (
                  <p className="text-sm text-[#6b7280] m-0">Cargando productos…</p>
                ) : showInspirationalEmpty ? (
                  <CatalogProductsEmptyState onCloned={loadProducts} />
                ) : products.length === 0 ? (
                  <CatalogProductsListEmptyMessage
                    variant={
                      productStatus === "archived"
                        ? "archived"
                        : hasActiveFilters || qDebounced
                          ? "search"
                          : "filtered"
                    }
                  />
                ) : (
                  <CatalogCardGrid>
                    {products.map((p) => (
                      <CatalogProductCard
                        key={p.id}
                        product={p}
                        onDuplicate={(id) => void duplicateProduct(id)}
                        onPatch={(id, body) => void patchProduct(id, body)}
                      />
                    ))}
                  </CatalogCardGrid>
                )}

                {!showInspirationalEmpty && counts.all > 0 ? (
                  <div className="rounded-xl border border-dashed border-[#e5e7eb] bg-[#fafafa] p-4 sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <p className="m-0 min-w-0 flex-1 text-sm leading-relaxed text-[#6b7280]">
                        ¿Querés sumar más ofertas sin crear todo desde cero? Explorá las plantillas del
                        sistema.
                      </p>
                      <Button
                        type="button"
                        variant="secondary"
                        size="md"
                        className="w-full shrink-0 sm:w-auto"
                        onClick={() => setPageTab("recomendados")}
                      >
                        Ver recomendados
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </DsCatalogShell>
      </CatalogWorkspaceSection>
    </>
  );
}
