/**
 * GET /api/referrals/me — Datos del referido del fotógrafo logueado (link, lista de referidos, métricas).
 * POST /api/referrals/me — Crear código de referido si no existe (solo fotógrafos).
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { maskEmail, maskName } from "@/lib/referral-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_URL = process.env.APP_URL || "https://www.compramelafoto.com";
const REFERRAL_SIGNUP_PATH = "/land";

async function getSalesCountForUser(userId: number): Promise<number> {
  const [albumOrders, printOrders] = await Promise.all([
    prisma.order.count({
      where: {
        album: { userId },
        status: "PAID",
      },
    }),
    prisma.printOrder.count({
      where: {
        photographerId: userId,
        paymentStatus: "PAID",
      },
    }),
  ]);
  return albumOrders + printOrders;
}

export async function GET() {
  try {
    const { error, user } = await requireAuth([
      Role.PHOTOGRAPHER,
      Role.LAB_PHOTOGRAPHER,
      Role.LAB,
    ]);

    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Solo fotógrafos y laboratorios." },
        { status: 401 }
      );
    }

    const userWithMp = await prisma.user.findUnique({
      where: { id: user.id },
      select: { mpUserId: true, mpConnectedAt: true, cbu: true, cbuTitular: true },
    });
    const mpConnected = !!(userWithMp?.mpUserId || userWithMp?.mpConnectedAt);

    const referralCode = await prisma.referralCode.findUnique({
      where: { ownerUserId: user.id, isActive: true },
      select: { id: true, code: true },
    });

    const attributions = await prisma.referralAttribution.findMany({
      where: { referrerUserId: user.id },
      include: {
        referredUser: {
          select: { id: true, email: true, name: true, createdAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const referred = await Promise.all(
      attributions.map(async (a) => {
        const salesCount = await getSalesCountForUser(a.referredUserId);
        const now = new Date();
        const status: string =
          a.status !== "ACTIVE"
            ? a.status
            : now > a.endsAt
              ? "EXPIRED"
              : "ACTIVE";
        return {
          id: a.id,
          maskedEmail: maskEmail(a.referredUser.email),
          maskedName: maskName(a.referredUser.name),
          createdAt: a.createdAt.toISOString(),
          status,
          salesCount,
        };
      })
    );

    const url = referralCode
      ? `${APP_URL}${REFERRAL_SIGNUP_PATH}?ref=${encodeURIComponent(referralCode.code)}`
      : null;

    // Balance: comisiones no cobradas, no revertidas ni aplicadas a descuento de fee propio
    const balanceAgg = await prisma.referralEarning.aggregate({
      where: {
        attribution: { referrerUserId: user.id },
        paidOutAt: null,
        reversedAt: null,
        appliedAt: null,
      },
      _sum: { referralAmountCents: true },
    });
    const balanceCents = balanceAgg._sum.referralAmountCents ?? 0;

    const totalPaidAgg = await prisma.referralEarning.aggregate({
      where: {
        attribution: { referrerUserId: user.id },
        paidOutAt: { not: null },
      },
      _sum: { referralAmountCents: true },
    });
    const totalPaidCents = totalPaidAgg._sum.referralAmountCents ?? 0;

    const payoutRequests = await prisma.referralPayoutRequest.findMany({
      where: { referrerUserId: user.id },
      orderBy: { requestedAt: "desc" },
      take: 10,
      select: {
        id: true,
        amountCents: true,
        status: true,
        requestedAt: true,
        paidAt: true,
      },
    });

    return NextResponse.json({
      mpConnected,
      cbu: userWithMp?.cbu ?? null,
      cbuTitular: userWithMp?.cbuTitular ?? null,
      referralCode: referralCode ? { code: referralCode.code, url } : null,
      totalReferred: referred.length,
      referred,
      balanceCents,
      totalPaidCents,
      payoutRequests: payoutRequests.map((r) => ({
        id: r.id,
        amountCents: r.amountCents,
        status: r.status,
        requestedAt: r.requestedAt.toISOString(),
        paidAt: r.paidAt?.toISOString() ?? null,
      })),
    });
  } catch (err: any) {
    console.error("GET /api/referrals/me ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo datos de referidos" },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const { error, user } = await requireAuth([
      Role.PHOTOGRAPHER,
      Role.LAB_PHOTOGRAPHER,
      Role.LAB,
    ]);

    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Solo fotógrafos y laboratorios pueden crear código de referido." },
        { status: 401 }
      );
    }

    const userWithMp = await prisma.user.findUnique({
      where: { id: user.id },
      select: { mpUserId: true, mpConnectedAt: true },
    });
    const mpConnected = !!(userWithMp?.mpUserId || userWithMp?.mpConnectedAt);
    if (!mpConnected) {
      return NextResponse.json(
        { error: "Para generar tu link de referidos tenés que conectar Mercado Pago primero." },
        { status: 403 }
      );
    }

    const existing = await prisma.referralCode.findUnique({
      where: { ownerUserId: user.id },
      select: { code: true },
    });

    if (existing) {
      const url = `${APP_URL}${REFERRAL_SIGNUP_PATH}?ref=${encodeURIComponent(existing.code)}`;
      return NextResponse.json({
        referralCode: { code: existing.code, url },
      });
    }

    const { generateReferralCode } = await import("@/lib/referral-helpers");
    let code = generateReferralCode();
    for (let i = 0; i < 10; i++) {
      const exists = await prisma.referralCode.findUnique({
        where: { code },
        select: { id: true },
      });
      if (!exists) break;
      code = generateReferralCode();
    }

    await prisma.referralCode.create({
      data: {
        code,
        ownerUserId: user.id,
        isActive: true,
      },
    });

    const url = `${APP_URL}${REFERRAL_SIGNUP_PATH}?ref=${encodeURIComponent(code)}`;
    return NextResponse.json({
      referralCode: { code, url },
    });
  } catch (err: any) {
    console.error("POST /api/referrals/me ERROR >>>", err);
    return NextResponse.json(
      { error: "Error creando código de referido" },
      { status: 500 }
    );
  }
}

/** PATCH /api/referrals/me — Actualizar CBU/Alias para cobro de comisiones. */
export async function PATCH(req: Request) {
  try {
    const { error, user } = await requireAuth([
      Role.PHOTOGRAPHER,
      Role.LAB_PHOTOGRAPHER,
      Role.LAB,
    ]);

    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Solo fotógrafos y laboratorios." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const cbu = typeof body.cbu === "string" ? body.cbu.trim() || null : body.cbu === null ? null : undefined;
    const cbuTitular = typeof body.cbuTitular === "string" ? body.cbuTitular.trim() || null : body.cbuTitular === null ? null : undefined;
    if (cbu === undefined) {
      return NextResponse.json(
        { error: "Se requiere 'cbu' (string o null)." },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        cbu,
        ...(cbuTitular !== undefined && { cbuTitular }),
      },
    });

    const updated = await prisma.user.findUnique({
      where: { id: user.id },
      select: { cbu: true, cbuTitular: true },
    });
    return NextResponse.json({ cbu: updated?.cbu ?? null, cbuTitular: updated?.cbuTitular ?? null });
  } catch (err: any) {
    console.error("PATCH /api/referrals/me ERROR >>>", err);
    return NextResponse.json(
      { error: "Error actualizando CBU" },
      { status: 500 }
    );
  }
}
