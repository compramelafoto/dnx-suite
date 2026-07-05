"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import PhotographerDashboardHeader from "@/components/photographer/PhotographerDashboardHeader";
import Button from "@/components/ui/Button";
import { DsDashboardInner, DsPageShell } from "@/components/ui/DsLayout";
import CatalogProductsGate from "@/components/dashboard/catalog-products/CatalogProductsGate";
import CatalogProductForm from "@/components/dashboard/catalog-products/CatalogProductForm";
import type { CatalogProductListItem } from "@/lib/catalog-products/serialize";

export default function CatalogProductEditPage() {
  const params = useParams();
  const router = useRouter();
  const productId = parseInt(String(params?.id ?? ""), 10);

  const [product, setProduct] = useState<CatalogProductListItem | null>(null);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(productId)) {
      setError("ID inválido");
      setLoading(false);
      return;
    }
    Promise.all([
      fetch(`/api/dashboard/catalog-products/${productId}`, { cache: "no-store" }),
      fetch("/api/dashboard/catalog-product-categories", { cache: "no-store" }),
    ])
      .then(async ([pRes, cRes]) => {
        const pData = await pRes.json().catch(() => ({}));
        const cData = await cRes.json().catch(() => ({}));
        if (!pRes.ok) {
          throw new Error(typeof pData.error === "string" ? pData.error : "No encontrado");
        }
        setProduct(pData as CatalogProductListItem);
        if (Array.isArray(cData.categories)) {
          setCategories(
            cData.categories.map((c: { id: number; name: string }) => ({ id: c.id, name: c.name }))
          );
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Error");
      })
      .finally(() => setLoading(false));
  }, [productId]);

  async function duplicate() {
    const res = await fetch(`/api/dashboard/catalog-products/${productId}/duplicate`, {
      method: "POST",
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) router.push(`/dashboard/productos/${data.id}`);
    else alert(typeof data.error === "string" ? data.error : "Error al duplicar");
  }

  async function archive() {
    if (!confirm("¿Archivar este producto?")) return;
    const res = await fetch(`/api/dashboard/catalog-products/${productId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isArchived: true }),
    });
    if (res.ok) router.push("/dashboard/productos?status=archived");
    else {
      const data = await res.json().catch(() => ({}));
      alert(typeof data.error === "string" ? data.error : "Error");
    }
  }

  return (
    <CatalogProductsGate>
      <PhotographerDashboardHeader photographer={null} />
      <section className="py-10 md:py-12 bg-[#f9fafb] min-h-screen w-full min-w-0">
        <DsPageShell>
          <DsDashboardInner className="w-full ds-stack-section gap-6">
            <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h1 className="text-2xl font-medium text-[#1a1a1a] m-0">Editar producto</h1>
              <div className="flex flex-wrap gap-2">
                <Link href="/dashboard/productos">
                  <Button type="button" variant="secondary" size="md">
                    ← Mis Packs y Combos
                  </Button>
                </Link>
                {product ? (
                  <>
                    <Button type="button" variant="secondary" size="md" onClick={() => void duplicate()}>
                      Duplicar
                    </Button>
                    {!product.isArchived ? (
                      <Button type="button" variant="secondary" size="md" onClick={() => void archive()}>
                        Archivar
                      </Button>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>

            {loading ? (
              <p className="text-sm text-[#6b7280]">Cargando…</p>
            ) : error || !product ? (
              <p className="text-sm text-red-700">{error ?? "Producto no encontrado"}</p>
            ) : (
              <CatalogProductForm
                mode="edit"
                productId={productId}
                initial={product}
                categories={categories}
                onSaved={() => router.push("/dashboard/productos")}
                onCancel={() => router.push("/dashboard/productos")}
              />
            )}
          </DsDashboardInner>
        </DsPageShell>
      </section>
    </CatalogProductsGate>
  );
}
