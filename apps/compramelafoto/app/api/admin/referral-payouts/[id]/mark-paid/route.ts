/**
 * POST /api/admin/referral-payouts/[id]/mark-paid
 * Marca una solicitud de cobro como pagada y setea paidOutAt en los ReferralEarning del referidor.
 * Body opcional: { externalRef?: string, notes?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const params = await (ctx.params as Promise<{ id: string }>).then((p) => p);
    const id = parseInt(params.id, 10);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const externalRef = (body.externalRef as string) || null;
    const notes = (body.notes as string) || null;

    const payoutRequest = await prisma.referralPayoutRequest.findUnique({
      where: { id },
    });
    if (!payoutRequest) {
      return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
    }
    if (payoutRequest.status !== "PENDING") {
      return NextResponse.json(
        { error: `La solicitud ya está en estado ${payoutRequest.status}` },
        { status: 400 }
      );
    }

    // Marcar earnings del referidor como pagados (solo no revertidos ni aplicados a descuento; los más viejos primero)
    const earnings = await prisma.referralEarning.findMany({
      where: {
        attribution: { referrerUserId: payoutRequest.referrerUserId },
        paidOutAt: null,
        reversedAt: null,
        appliedAt: null,
      },
      orderBy: { createdAt: "asc" },
    });

    let remaining = payoutRequest.amountCents;
    const toMark: number[] = [];
    for (const e of earnings) {
      if (remaining <= 0) break;
      toMark.push(e.id);
      remaining -= e.referralAmountCents;
    }

    const now = new Date();
    await prisma.$transaction([
      prisma.referralEarning.updateMany({
        where: { id: { in: toMark } },
        data: { paidOutAt: now },
      }),
      prisma.referralPayoutRequest.update({
        where: { id },
        data: {
          status: "PAID",
          paidAt: now,
          paidByUserId: user.id,
          externalRef: externalRef ?? undefined,
          notes: notes ?? undefined,
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      message: "Solicitud marcada como pagada.",
      earningsMarked: toMark.length,
    });
  } catch (err: any) {
    console.error("POST /api/admin/referral-payouts/[id]/mark-paid ERROR >>>", err);
    return NextResponse.json(
      { error: "Error al marcar como pagada" },
      { status: 500 }
    );
  }
}
