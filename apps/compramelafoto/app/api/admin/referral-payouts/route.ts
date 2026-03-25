/**
 * GET /api/admin/referral-payouts
 * Lista solicitudes de cobro de referidores (para que admin marque como pagadas).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const status = req.nextUrl.searchParams.get("status") || "";
    const list = await prisma.referralPayoutRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { requestedAt: "desc" },
      take: 100,
      include: {
        referrerUser: {
          select: { id: true, name: true, email: true, cbu: true, cbuTitular: true },
        },
      },
    });

    return NextResponse.json({
      payoutRequests: list.map((r) => ({
        id: r.id,
        amountCents: r.amountCents,
        status: r.status,
        requestedAt: r.requestedAt.toISOString(),
        paidAt: r.paidAt?.toISOString() ?? null,
        paidByUserId: r.paidByUserId,
        externalRef: r.externalRef,
        notes: r.notes,
        referrer: r.referrerUser
          ? {
              id: r.referrerUser.id,
              name: r.referrerUser.name,
              email: r.referrerUser.email,
              cbu: r.referrerUser.cbu ?? null,
              cbuTitular: r.referrerUser.cbuTitular ?? null,
            }
          : null,
      })),
    });
  } catch (err: any) {
    console.error("GET /api/admin/referral-payouts ERROR >>>", err);
    return NextResponse.json(
      { error: "Error listando solicitudes de cobro" },
      { status: 500 }
    );
  }
}
