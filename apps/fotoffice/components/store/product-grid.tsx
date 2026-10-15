import type { StoreProductCard } from "@/lib/store/storefront";
import { ProductCard } from "./product-card";

/** La grilla de la vitrina: dos columnas en el teléfono, tres en tableta, cuatro en escritorio. */
export function ProductGrid({ products, basePath }: { products: StoreProductCard[]; basePath: string }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <li key={p.productId} className="min-w-0">
          <ProductCard product={p} href={`${basePath}/${p.slug}`} />
        </li>
      ))}
    </ul>
  );
}
