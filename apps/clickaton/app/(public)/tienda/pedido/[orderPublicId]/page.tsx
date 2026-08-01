import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { SimpleBreadcrumb } from "@/components/content/SimpleBreadcrumb";
import { StoreOrderView } from "@/components/store/checkout/StoreOrderView";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/Button";
import { routes } from "@/config/navigation";
import { STORE_ORDER_ACCESS_COOKIE } from "@/lib/public-store/checkout/access-token";
import { StoreCheckoutError } from "@/lib/public-store/checkout/errors";
import { getPublicStoreOrder } from "@/lib/public-store/checkout/get-store-order";
import { buildPageMetadata } from "@/lib/seo";

type PageProps = {
  params: Promise<{ orderPublicId: string }>;
  searchParams: Promise<{ t?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { orderPublicId } = await params;
  const base = buildPageMetadata({
    title: "Pedido",
    description: "Detalle de pedido Tienda Clickatón.",
    path: `/tienda/pedido/${orderPublicId}`,
    noIndex: true,
  });
  return {
    ...base,
    title: { absolute: "Pedido | Tienda Clickatón" },
    robots: { index: false, follow: false, nocache: true },
  };
}

export default async function StoreOrderPage({ params, searchParams }: PageProps) {
  const { orderPublicId } = await params;
  const sp = await searchParams;
  const jar = await cookies();
  const accessToken = sp.t?.trim() || jar.get(STORE_ORDER_ACCESS_COOKIE)?.value || null;

  let order;
  try {
    order = await getPublicStoreOrder({
      publicId: orderPublicId,
      accessToken,
    });
  } catch (err) {
    if (err instanceof StoreCheckoutError && err.code === "ORDER_NOT_FOUND") {
      notFound();
    }
    if (err instanceof StoreCheckoutError && err.code === "ACCESS_DENIED") {
      return (
        <Section>
          <Container>
            <h1 className="ck-display-md">Acceso restringido</h1>
            <p className="mt-4 ck-body text-ck-text-secondary">
              No tenés permiso para ver este pedido. Usá el enlace que recibiste o la
              sesión del mismo navegador donde compraste.
            </p>
            <div className="mt-8">
              <Button href={routes.store} variant="secondary">
                Ir a la tienda
              </Button>
            </div>
          </Container>
        </Section>
      );
    }
    throw err;
  }

  return (
    <>
      <SimpleBreadcrumb
        items={[
          { label: "Inicio", href: routes.home },
          { label: "Tienda", href: routes.store },
          { label: "Pedido" },
        ]}
      />
      <Section aria-labelledby="store-order-title">
        <Container>
          <div id="store-order-title" className="sr-only">
            Pedido {order.publicId}
          </div>
          <StoreOrderView order={order} />
        </Container>
      </Section>
    </>
  );
}
