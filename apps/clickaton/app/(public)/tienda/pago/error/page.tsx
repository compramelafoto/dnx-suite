import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { StorePaymentReturnView } from "@/components/store/checkout/StorePaymentReturnView";
import { STORE_ORDER_ACCESS_COOKIE } from "@/lib/public-store/checkout/access-token";
import { getPublicStoreOrder } from "@/lib/public-store/checkout/get-store-order";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  ...buildPageMetadata({
    title: "Error de pago",
    description: "Retorno de pago Tienda Clickatón.",
    path: "/tienda/pago/error",
    noIndex: true,
  }),
  robots: { index: false, follow: false, nocache: true },
};

type Props = { searchParams: Promise<{ order?: string; t?: string }> };

export default async function StorePaymentErrorPage({ searchParams }: Props) {
  const sp = await searchParams;
  const publicId = sp.order?.trim() || null;
  const jar = await cookies();
  const token = sp.t?.trim() || jar.get(STORE_ORDER_ACCESS_COOKIE)?.value || null;

  let canonicalStatus: string | null = null;
  let orderPath: string | null = publicId
    ? `/tienda/pedido/${encodeURIComponent(publicId)}`
    : null;
  if (publicId && token) {
    try {
      const order = await getPublicStoreOrder({ publicId, accessToken: token });
      canonicalStatus = `${order.status} / ${order.paymentStatus}`;
    } catch {
      /* ignore */
    }
  }

  return (
    <Section>
      <Container>
        <StorePaymentReturnView
          variant="error"
          publicId={publicId}
          orderPath={orderPath}
          canonicalStatus={canonicalStatus}
        />
      </Container>
    </Section>
  );
}
