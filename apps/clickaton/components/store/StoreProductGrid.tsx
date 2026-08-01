import { StoreProductCard } from "@/components/store/StoreProductCard";
import type { StoreProductCardDto } from "@/lib/public-store/types";

type StoreProductGridProps = {
  products: StoreProductCardDto[];
  titleId?: string;
};

/**
 * Grilla responsive del catálogo TIENDA:
 * mobile 1 · tablet 2 · desktop 4 columnas.
 */
export function StoreProductGrid({
  products,
  titleId = "store-catalog-title",
}: StoreProductGridProps) {
  if (products.length === 0) return null;

  return (
    <ul
      className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-4"
      aria-labelledby={titleId}
    >
      {products.map((product) => (
        <li key={product.id} className="min-w-0">
          <StoreProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}
