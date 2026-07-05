import { NextResponse } from "next/server";
import { OrderOrigin, OrderStatus } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/order-claims";
import { createPackAccessTokenForOrder } from "@/lib/preventa-canjeable/pack-access-tokens";
import { queuePreventaPackRecoveryEmail } from "@/lib/order-confirmation-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_URL =
  process.env.APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://compramelafoto.com");

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const rawEmail = typeof body?.email === "string" ? body.email : "";
  const email = normalizeEmail(rawEmail);

  // Respuesta genérica para no revelar si existe o no el email.
  const okResponse = NextResponse.json({
    ok: true,
    message: "Si encontramos pedidos con ese email, te enviamos un link.",
  });

  if (!email || !email.includes("@")) {
    return okResponse;
  }

  const orders = await prisma.order.findMany({
    where: {
      origin: OrderOrigin.PREVENTA_PACK,
      status: OrderStatus.PAID,
      buyerEmail: { equals: email, mode: "insensitive" },
    },
    select: {
      id: true,
      album: { select: { title: true } },
    },
  });

  if (orders.length === 0) {
    return okResponse;
  }

  const packs: Array<{ orderId: number; albumTitle: string | null; packAccessUrl: string }> = [];
  for (const order of orders) {
    const tokenData = await createPackAccessTokenForOrder(order.id, { revokeExisting: true });
    if (!tokenData?.token) continue;
    packs.push({
      orderId: order.id,
      albumTitle: order.album?.title ?? null,
      packAccessUrl: `${APP_URL}/cliente/pack/${tokenData.token}`,
    });
  }

  if (packs.length > 0) {
    await queuePreventaPackRecoveryEmail({ email, packs });
  }

  return okResponse;
}
