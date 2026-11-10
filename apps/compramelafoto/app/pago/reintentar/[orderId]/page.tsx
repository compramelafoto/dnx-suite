import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { bloqueaCheckoutPro } from "@/lib/split-1n-piloto/snapshot";

/**
 * Enlace corto para reintentar un pago (lo usa DNX Bot: la burbuja no admite `?` en enlaces).
 * La página de pago fallido ya pide el mail si no hay sesión.
 *
 * Un pedido del piloto Split 1:N se reintenta en su propia página (/pagar), que sabe si hay un
 * cobro con tarjeta en curso y ofrece «Pagar con Mercado Pago» sin riesgo de cobrar dos veces.
 */
export default async function ReintentarPagoPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const n = Number(orderId);
  if (!Number.isInteger(n) || n <= 0) notFound();
  const order = await prisma.order
    .findUnique({ where: { id: n }, select: { pricingSnapshot: true } })
    .catch(() => null);
  if (order && bloqueaCheckoutPro(order.pricingSnapshot)) redirect(`/pagar/${n}`);
  redirect(`/pago/failure?orderId=${n}&orderType=ALBUM_ORDER`);
}
