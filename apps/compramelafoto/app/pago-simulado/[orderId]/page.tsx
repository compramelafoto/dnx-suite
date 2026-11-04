import { notFound } from "next/navigation";
import { OrderOrigin } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { esUsuarioDemo } from "@/lib/demos/identidad";
import { getDemoActiva } from "@/lib/demos/sesion-demo";
import { actorPuedeUsarPagoSimulado } from "@/lib/demos/pago-simulado-galeria";
import PagoSimuladoClient from "./PagoSimuladoClient";

export const dynamic = "force-dynamic";

/**
 * Pantalla de pago simulado de las demos grabables: imita el paso por Mercado Pago. Solo para
 * pedidos de prueba de álbumes de usuarios demo.
 * - Preventa: la ve el fotógrafo demo dueño del álbum.
 * - Compra de la galería: la ve el dueño del álbum o quien tiene la demo activa.
 */
export default async function PagoSimuladoPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId: raw } = await params;
  const orderId = Number(raw);
  if (!Number.isInteger(orderId) || orderId <= 0) notFound();

  const user = await getAuthUser();
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      isTest: true,
      origin: true,
      albumId: true,
      totalCents: true,
      preCompraPaymentRef: true,
      album: {
        select: { title: true, publicSlug: true, userId: true, user: { select: { id: true, tags: true, name: true } } },
      },
    },
  });
  if (!order?.isTest || !order.album || !esUsuarioDemo(order.album.user)) notFound();

  const esPreventa = order.origin === OrderOrigin.PREVENTA_PACK;
  if (esPreventa) {
    if (!user || order.album.userId !== user.id) notFound();
  } else {
    const demoActiva = (await getDemoActiva()) != null;
    if (!actorPuedeUsarPagoSimulado(order.album.user, { userId: user?.id ?? null, demoActiva })) notFound();
  }

  return (
    <PagoSimuladoClient
      orderId={order.id}
      preCompraOrderId={esPreventa && order.preCompraPaymentRef ? Number(order.preCompraPaymentRef) : null}
      totalPesos={order.totalCents}
      concepto={esPreventa ? order.album.title : `Fotos de «${order.album.title}»`}
      vendedor={order.album.user?.name ?? "Fotógrafo"}
      volverA={esPreventa ? `/album/${order.album.publicSlug}/preventa` : `/a/${order.albumId}/comprar/resumen`}
    />
  );
}
