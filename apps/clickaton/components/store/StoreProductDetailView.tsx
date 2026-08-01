import { StoreProductGallery } from "@/components/store/StoreProductGallery";
import { StoreProductInfo } from "@/components/store/StoreProductInfo";
import { StoreProductOptionsPanel } from "@/components/store/StoreProductOptionsPanel";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import type { PublicStoreProductDetail } from "@/lib/public-store/types";

type StoreProductDetailViewProps = {
  product: PublicStoreProductDetail;
};

/**
 * Layout de ficha: galería | información (desktop) / stack (mobile).
 */
export function StoreProductDetailView({ product }: StoreProductDetailViewProps) {
  return (
    <Section aria-labelledby="store-product-title">
      <Container>
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-12 xl:gap-16">
          <StoreProductGallery
            images={product.images}
            productName={product.name}
          />
          <div className="min-w-0 space-y-8">
            <StoreProductInfo product={product}>
              <StoreProductOptionsPanel
                productId={product.id}
                productName={product.name}
                variants={product.variants}
                productAvailability={product.availability}
                initialSelectedVariantId={product.initialSelectedVariantId}
              />
            </StoreProductInfo>
            <div className="space-y-3 border-t border-ck-border pt-8">
              <h2 className="ck-heading-md">Información adicional</h2>
              <ul className="ck-body-sm list-disc space-y-2 pl-5 text-ck-text-secondary">
                <li>Producto oficial de la comunidad Clickatón.</li>
                <li>
                  Podés armar tu carrito ahora; el checkout se habilitará en una
                  etapa posterior.
                </li>
                <li>
                  El stock mostrado es informativo: el carrito no reserva
                  unidades.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
