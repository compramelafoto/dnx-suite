import { StoreProductGrid } from "@/components/store/StoreProductGrid";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import type { StoreProductCardDto } from "@/lib/public-store/types";

type StoreRelatedProductsProps = {
  products: StoreProductCardDto[];
};

/**
 * Sección “También te puede interesar”.
 * Se oculta por completo si no hay relacionados.
 */
export function StoreRelatedProducts({ products }: StoreRelatedProductsProps) {
  if (products.length === 0) return null;

  return (
    <Section tone="raised" aria-labelledby="store-related-title">
      <Container>
        <h2 id="store-related-title" className="ck-heading-lg">
          También te puede interesar
        </h2>
        <StoreProductGrid
          products={products}
          titleId="store-related-title"
        />
      </Container>
    </Section>
  );
}
