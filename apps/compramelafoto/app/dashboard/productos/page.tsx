import { Suspense } from "react";
import CatalogProductsGate from "@/components/dashboard/catalog-products/CatalogProductsGate";
import CatalogProductsListClient from "@/components/dashboard/catalog-products/CatalogProductsListClient";

export default function CatalogProductsPage() {
  return (
    <CatalogProductsGate>
      <Suspense fallback={<p className="p-8 text-center text-[#6b7280]">Cargando…</p>}>
        <CatalogProductsListClient />
      </Suspense>
    </CatalogProductsGate>
  );
}
