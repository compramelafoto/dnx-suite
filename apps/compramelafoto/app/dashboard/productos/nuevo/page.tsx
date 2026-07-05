"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PhotographerDashboardHeader from "@/components/photographer/PhotographerDashboardHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { DsCatalogShell } from "@/components/ui/DsLayout";
import { CatalogPageHeader, CatalogWorkspaceSection } from "@/components/dashboard/catalog/CatalogWorkspaceUI";
import CatalogProductsGate from "@/components/dashboard/catalog-products/CatalogProductsGate";
import { CatalogProductsEmptyShell } from "@/components/dashboard/catalog-products/CatalogProductsEmptyShell";
import { DsEmptyState } from "@/components/ui/DsEmptyState";
import CatalogProductForm from "@/components/dashboard/catalog-products/CatalogProductForm";
import type { CatalogProductListItem } from "@/lib/catalog-products/serialize";

export default function CatalogProductNewPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/catalog-product-categories", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.categories)) {
          setCategories(data.categories.map((c: { id: number; name: string }) => ({ id: c.id, name: c.name })));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <CatalogProductsGate>
      <PhotographerDashboardHeader photographer={null} />
      <CatalogWorkspaceSection className="!min-h-0">
        <DsCatalogShell>
          <div className="ds-catalog-stack">
            <CatalogPageHeader
              title="Crear producto"
              subtitle="Definí nombre, precio, tipo e imagen de tu producto propio."
              actions={
                <Link href="/dashboard/productos">
                  <Button type="button" variant="secondary" size="md">
                    ← Mis Packs y Combos
                  </Button>
                </Link>
              }
            />

            {loading ? (
              <p className="text-sm text-[#6b7280]">Cargando…</p>
            ) : categories.length === 0 ? (
              <CatalogProductsEmptyShell>
                <Card className="ds-fill-width w-full min-w-0 p-0">
                  <DsEmptyState title="Primero creá categorías" className="ds-empty-state--catalog">
                    <p className="ds-readable-text ds-readable-text--center ds-readable-text--sm m-0">
                      Creá al menos una categoría antes de agregar productos a tu catálogo.
                    </p>
                    <div className="ds-empty-state__actions">
                      <Link href="/dashboard/productos/categorias" className="ds-empty-state__cta">
                        <Button type="button" variant="primary" size="md" className="w-full sm:w-auto">
                          Ir a categorías
                        </Button>
                      </Link>
                    </div>
                  </DsEmptyState>
                </Card>
              </CatalogProductsEmptyShell>
            ) : (
              <CatalogProductForm
                mode="create"
                categories={categories}
                onSaved={(p: CatalogProductListItem) => router.push(`/dashboard/productos/${p.id}`)}
                onCancel={() => router.push("/dashboard/productos")}
              />
            )}
          </div>
        </DsCatalogShell>
      </CatalogWorkspaceSection>
    </CatalogProductsGate>
  );
}
