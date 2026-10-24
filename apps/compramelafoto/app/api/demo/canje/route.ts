import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDemoActiva } from "@/lib/demos/sesion-demo";
import { getContextoDemoEscolar } from "@/lib/demos/escolar/contexto";
import { createPackAccessTokenForOrder } from "@/lib/preventa-canjeable/pack-access-tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/demo/canje — abre el canje de la última compra de la demo, como si la familia tocara el
 * link de su correo (que en la demo no sale). Genera un link nuevo cada vez.
 */
export async function GET(req: NextRequest) {
  const volver = new URL("/admin/demos", req.nextUrl.origin);
  if (!(await getDemoActiva())) return NextResponse.redirect(volver);
  const ctx = await getContextoDemoEscolar();
  if (!ctx) return NextResponse.redirect(volver);

  const pedido = await prisma.order.findFirst({
    where: { albumId: ctx.albumId, isTest: true, status: "PAID", origin: "PREVENTA_PACK" },
    orderBy: { id: "desc" },
    select: { id: true },
  });
  if (!pedido) {
    return NextResponse.redirect(new URL(`/album/${ctx.albumSlug}?ref=school_${ctx.schoolId}`, req.nextUrl.origin));
  }
  const token = await createPackAccessTokenForOrder(pedido.id, { revokeExisting: true });
  if (!token?.token) return NextResponse.redirect(new URL(`/album/${ctx.albumSlug}`, req.nextUrl.origin));
  return NextResponse.redirect(new URL(`/cliente/pack/${token.token}`, req.nextUrl.origin));
}
