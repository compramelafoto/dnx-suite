import CatalogProductsGate from "@/components/dashboard/catalog-products/CatalogProductsGate";
import CatalogCategoriesClient from "@/components/dashboard/catalog-products/CatalogCategoriesClient";

export default function CatalogCategoriesPage() {
  return (
    <CatalogProductsGate>
      <CatalogCategoriesClient />
    </CatalogProductsGate>
  );
}
