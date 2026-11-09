import { prisma } from "@/lib/prisma";
import { queueEmail } from "@/lib/email-queue";
import { armarComprobanteGrupo } from "./correo-contenido";
import { claveComprobanteGrupo } from "./cron";
import { leerMarcaGrupo, urlPagoGrupo } from "./marca";

function appUrl(): string {
  return (process.env.APP_URL || "https://www.compramelafoto.com").replace(/\/+$/, "");
}

/**
 * Encola el comprobante único de un carrito de evento, sólo cuando todos sus pedidos están
 * pagados. Idempotente por grupo: se puede llamar en cada aviso o visita sin duplicar.
 * Devuelve true si el comprobante quedó (o ya estaba) en la cola.
 */
export async function encolarComprobanteGrupo(grupoId: string): Promise<boolean> {
  const pedidos = await prisma.order.findMany({
    where: { pricingSnapshot: { path: ["split1nGrupo", "grupoId"], equals: grupoId } },
    orderBy: { id: "asc" },
    select: {
      id: true,
      status: true,
      buyerEmail: true,
      totalCents: true,
      pricingSnapshot: true,
      album: { select: { user: { select: { name: true } }, event: { select: { title: true } } } },
      _count: { select: { items: true } },
    },
  });
  const marca = pedidos[0] ? leerMarcaGrupo(pedidos[0].pricingSnapshot) : null;
  if (!marca || pedidos.length !== marca.pedidos.length || pedidos.some((p) => p.status !== "PAID")) {
    return false;
  }
  const contenido = armarComprobanteGrupo({
    buyerEmail: pedidos[0].buyerEmail,
    totalPesos: pedidos.reduce((acc, p) => acc + p.totalCents, 0),
    descargasUrl: `${appUrl()}${urlPagoGrupo(grupoId)}`,
    eventoTitulo: pedidos[0].album?.event?.title ?? null,
    pedidos: pedidos.map((p) => ({
      pedidoId: p.id,
      fotografo: p.album?.user?.name?.trim() || "Fotógrafo",
      fotos: p._count.items,
      totalPesos: p.totalCents,
    })),
  });
  await queueEmail({
    to: pedidos[0].buyerEmail,
    subject: contenido.subject,
    body: contenido.text,
    htmlBody: contenido.html,
    idempotencyKey: claveComprobanteGrupo(grupoId),
  });
  return true;
}
