import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { OrderOrigin, OrderStatus, Role, prisma } from "@/lib/prisma";
import { createPackAccessTokenForOrder } from "@/lib/preventa-canjeable/pack-access-tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST `{ packOrderId }`: link para que el fotógrafo elija las fotos de un pack por la familia.
 *
 * Es un link aparte, de un día, que NO revoca el de la familia (`revokeExisting: false`): si la
 * familia todavía puede elegir, su link sigue andando y gana el primero que confirma.
 */
export async function POST(req: NextRequest) {
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
  if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { packOrderId?: unknown } | null;
  const packOrderId = Number(body?.packOrderId);
  if (!Number.isInteger(packOrderId) || packOrderId <= 0) {
    return NextResponse.json({ error: "Pack inválido" }, { status: 400 });
  }

  const pack = await prisma.order.findUnique({
    where: { id: packOrderId },
    select: { id: true, origin: true, status: true, redemptionOrderId: true, album: { select: { userId: true } } },
  });
  if (!pack || pack.origin !== OrderOrigin.PREVENTA_PACK || pack.album?.userId !== user.id) {
    return NextResponse.json({ error: "No encontramos ese pack en tus álbumes" }, { status: 403 });
  }
  if (pack.status !== OrderStatus.PAID) {
    return NextResponse.json({ error: "Ese pack todavía no está pago" }, { status: 409 });
  }
  if (pack.redemptionOrderId != null) {
    return NextResponse.json({ error: "Este pack ya fue elegido" }, { status: 409 });
  }

  const link = await createPackAccessTokenForOrder(pack.id, { ttlDays: 1, revokeExisting: false });
  if (!link) return NextResponse.json({ error: "No pudimos abrir el canje de ese pack" }, { status: 500 });
  return NextResponse.json({ url: `/canje/preventa/${encodeURIComponent(link.token)}?como=fotografo` });
}
