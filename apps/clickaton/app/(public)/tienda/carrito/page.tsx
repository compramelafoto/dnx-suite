import type { Metadata } from "next";
import { SimpleBreadcrumb } from "@/components/content/SimpleBreadcrumb";
import { StoreCartPageClient } from "@/components/store/cart/StoreCartPageClient";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { routes } from "@/config/navigation";
import { isStoreCheckoutEnabled } from "@/lib/public-store/checkout/feature-flags";
import { buildPageMetadata } from "@/lib/seo";

const baseMeta = buildPageMetadata({
  title: "Carrito",
  description: "Tu carrito de la Tienda Clickatón.",
  path: routes.storeCart,
  noIndex: true,
});

export const metadata: Metadata = {
  ...baseMeta,
  title: { absolute: "Tu carrito | Tienda Clickatón" },
  robots: { index: false, follow: false, nocache: true },
};

export default function StoreCartPage() {
  const checkoutEnabled = isStoreCheckoutEnabled();
  return (
    <>
      <SimpleBreadcrumb
        items={[
          { label: "Inicio", href: routes.home },
          { label: "Tienda", href: routes.store },
          { label: "Carrito" },
        ]}
      />
      <Section aria-labelledby="store-cart-title">
        <Container>
          <h1 id="store-cart-title" className="ck-display-md text-ck-text">
            Tu carrito
          </h1>
          <div className="mt-10">
            <StoreCartPageClient checkoutEnabled={checkoutEnabled} />
          </div>
        </Container>
      </Section>
    </>
  );
}
