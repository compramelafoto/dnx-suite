import { NextRequest, NextResponse } from "next/server";
import { OrderOrigin, OrderStatus, Role, prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { recuperarLinksDePack } from "@/lib/preventa-canjeable/recuperar-pack";
import { isPlaceholderEmail } from "@/lib/canje-externo/external-preventa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_POR_VEZ = 100;

/**
 * POST /api/fotografo/school-orders/reenviar-link — le vuelve a mandar a cada familia elegida su
 * link personal para canjear el pack. Body: `{ orderIds: number[] }`.
 *
 * Sólo packs propios, pagados, sin canjear y que no sean pruebas DEMO (las pruebas nunca mandan
 * correos). Cada envío crea un link nuevo y el anterior deja de andar, igual que cuando la
 * familia lo pide sola desde "Recuperar mi pack".
 */
export async function POST(req: NextRequest) {
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
  if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { orderIds?: unknown };
  const ids = Array.isArray(body.orderIds)
    ? [...new Set(body.orderIds.filter((n): n is number => Number.isInteger(n) && (n as number) > 0))]
    : [];
  if (ids.length === 0) return NextResponse.json({ error: "Elegí al menos un pedido." }, { status: 400 });
  if (ids.length > MAX_POR_VEZ) {
    return NextResponse.json({ error: `Se pueden reenviar hasta ${MAX_POR_VEZ} por vez.` }, { status: 400 });
  }

  const pedidos = await prisma.order.findMany({
    where: {
      id: { in: ids },
      origin: OrderOrigin.PREVENTA_PACK,
      status: OrderStatus.PAID,
      isTest: false,
      redemptionOrderId: null,
      album: { userId: user.id },
    },
    select: { id: true, buyerEmail: true },
  });

  let enviados = 0;
  let sinEmail = 0;
  for (const p of pedidos) {
    const email = p.buyerEmail?.trim() ?? "";
    // Los packs cobrados por fuera tienen un email de relleno hasta que la familia canjea: a
    // esos el link les llega por WhatsApp desde el panel Canjes, no por correo.
    if (!email.includes("@") || isPlaceholderEmail(email)) {
      sinEmail += 1;
      continue;
    }
    try {
      const r = await recuperarLinksDePack(email, { soloPedidoId: p.id });
      enviados += r.enviados;
    } catch (err) {
      console.error("[school-orders] no se pudo reenviar el link", { orderId: p.id, err });
    }
  }

  return NextResponse.json({
    ok: true,
    enviados,
    sinEmail,
    // Pedidos que no se tocaron: DEMO, ajenos, ya canjeados o de la tienda escolar.
    salteados: ids.length - pedidos.length,
  });
}
