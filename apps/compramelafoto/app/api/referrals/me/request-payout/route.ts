/**
 * POST /api/referrals/me/request-payout
 * Solicita cobro del saldo disponible (ReferralPayoutRequest PENDING).
 * No autoaprueba ni marca earnings como paidOut.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { evaluatePayoutEligibility } from "@/lib/referral/balance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REFERRER_ROLES = [Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER, Role.LAB] as const;

class PayoutRequestError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function POST() {
  try {
    const { error, user } = await requireAuth([...REFERRER_ROLES]);
    if (error || !user) {
      return NextResponse.json(
        {
          error:
            "No autorizado. Solo fotógrafos y laboratorios con programa de referidos.",
        },
        { status: 401 }
      );
    }

    const userBank = await prisma.user.findUnique({
      where: { id: user.id },
      select: { cbu: true, cbuTitular: true },
    });

    const created = await prisma.$transaction(async (tx) => {
      const pending = await tx.referralPayoutRequest.findFirst({
        where: { referrerUserId: user.id, status: "PENDING" },
        select: { id: true },
      });

      const balanceAgg = await tx.referralEarning.aggregate({
        where: {
          attribution: { referrerUserId: user.id },
          paidOutAt: null,
          reversedAt: null,
          appliedAt: null,
        },
        _sum: { referralAmountCents: true },
      });
      const balancePesos = balanceAgg._sum.referralAmountCents ?? 0;

      const eligibility = evaluatePayoutEligibility({
        balancePesos,
        hasPending: Boolean(pending),
        cbu: userBank?.cbu,
        cbuTitular: userBank?.cbuTitular,
      });

      if (!eligibility.ok) {
        throw new PayoutRequestError(eligibility.error, eligibility.status);
      }

      return tx.referralPayoutRequest.create({
        data: {
          referrerUserId: user.id,
          amountCents: eligibility.balancePesos,
          status: "PENDING",
        },
        select: {
          id: true,
          amountCents: true,
          status: true,
          requestedAt: true,
        },
      });
    });

    try {
      await prisma.adminSystemMessage.create({
        data: {
          type: `REFERRAL_PAYOUT_REQUEST:${created.id}`,
          title: "Solicitud de cobro de referidos",
          body: `Referidor userId=${user.id} · ${user.email}\nSolicitud #${created.id} · $${created.amountCents.toFixed(2)} ARS · PENDING`,
          isRead: false,
        },
      });
    } catch (notifyErr) {
      console.error("[referral-payout] aviso admin no creado:", notifyErr);
    }

    return NextResponse.json({
      ok: true,
      payoutRequest: {
        id: created.id,
        amountCents: created.amountCents,
        status: created.status,
        requestedAt: created.requestedAt.toISOString(),
      },
      message:
        "Tu solicitud de cobro fue registrada. Te pagaremos por Mercado Pago o transferencia en 24-48 h hábiles.",
    });
  } catch (err: unknown) {
    if (err instanceof PayoutRequestError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/referrals/me/request-payout ERROR >>>", err);
    return NextResponse.json(
      { error: "Error al solicitar cobro" },
      { status: 500 }
    );
  }
}
