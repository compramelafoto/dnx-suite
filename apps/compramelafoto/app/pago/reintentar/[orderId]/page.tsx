import { notFound, redirect } from "next/navigation";

/**
 * Enlace corto para reintentar un pago (lo usa DNX Bot: la burbuja no admite `?` en enlaces).
 * La página de pago fallido ya pide el mail si no hay sesión.
 */
export default async function ReintentarPagoPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const n = Number(orderId);
  if (!Number.isInteger(n) || n <= 0) notFound();
  redirect(`/pago/failure?orderId=${n}&orderType=ALBUM_ORDER`);
}
