import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { esUsuarioDemo } from "@/lib/demos/identidad";
import PagoSimuladoClient from "./PagoSimuladoClient";

export const dynamic = "force-dynamic";

/**
 * Pantalla de pago simulado de las demos grabables: imita el paso por Mercado Pago. Solo la ve el
 * fotógrafo demo dueño del álbum, con un pedido de prueba.
 */
export default async function PagoSimuladoPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId: raw } = await params;
  const orderId = Number(raw);
  if (!Number.isInteger(orderId) || orderId <= 0) notFound();

  const user = await getAuthUser();
  if (!user) notFound();
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      isTest: true,
      totalCents: true,
      preCompraPaymentRef: true,
      album: { select: { title: true, publicSlug: true, userId: true, user: { select: { tags: true, name: true } } } },
    },
  });
  if (!order?.isTest || !order.album || order.album.userId !== user.id || !esUsuarioDemo(order.album.user)) {
    notFound();
  }

  return (
    <PagoSimuladoClient
      orderId={order.id}
      preCompraOrderId={order.preCompraPaymentRef ? Number(order.preCompraPaymentRef) : null}
      totalPesos={order.totalCents}
      concepto={order.album.title}
      vendedor={order.album.user?.name ?? "Fotógrafo"}
      volverA={`/album/${order.album.publicSlug}/preventa`}
    />
  );
}
