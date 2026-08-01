import type { Metadata } from "next";
import { SimpleBreadcrumb } from "@/components/content/SimpleBreadcrumb";
import { StoreCheckoutForm } from "@/components/store/checkout/StoreCheckoutForm";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { routes } from "@/config/navigation";
import { isStoreCheckoutEnabled } from "@/lib/public-store/checkout/feature-flags";
import { buildPageMetadata } from "@/lib/seo";

const baseMeta = buildPageMetadata({
  title: "Checkout",
  description: "Confirmá tu compra en la Tienda Clickatón.",
  path: routes.storeCheckout,
  noIndex: true,
});

export const metadata: Metadata = {
  ...baseMeta,
  title: { absolute: "Checkout | Tienda Clickatón" },
  robots: { index: false, follow: false, nocache: true },
};

export default function StoreCheckoutPage() {
  const checkoutEnabled = isStoreCheckoutEnabled();

  return (
    <>
      <SimpleBreadcrumb
        items={[
          { label: "Inicio", href: routes.home },
          { label: "Tienda", href: routes.store },
          { label: "Carrito", href: routes.storeCart },
          { label: "Checkout" },
        ]}
      />
      <Section aria-labelledby="store-checkout-title">
        <Container>
          <h1 id="store-checkout-title" className="ck-display-md text-ck-text">
            Checkout
          </h1>
          <p className="mt-4 max-w-2xl ck-body text-ck-text-secondary">
            Revisá tu carrito, completá tus datos y confirmá la compra. El pago se procesa
            con la infraestructura de pagos de Clickatón.
          </p>
          <div className="mt-10">
            <StoreCheckoutForm checkoutEnabled={checkoutEnabled} />
          </div>
        </Container>
      </Section>
    </>
  );
}
