/**
 * POST /api/referrals/me/request-payout
 * El referidor solicita el cobro de sus comisiones acumuladas.
 * Crea una ReferralPayoutRequest (PENDING). Un admin puede marcarla como PAID
 * o en el futuro se podría llamar a una API de MP para transferir automáticamente.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const MIN_PAYOUT_PESOS = 1; // mínimo $1 para solicitar (los campos *Cents en referidos almacenan PESOS)

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const { error, user } = await requireAuth([
      Role.PHOTOGRAPHER,
      Role.LAB_PHOTOGRAPHER,
      Role.LAB,
    ]);

    if (error || !user) {
      return NextResponse.json(
        { error: "No autorizado. Solo fotógrafos y laboratorios con programa de referidos." },
        { status: 401 }
      );
    }

    const userBank = await prisma.user.findUnique({
      where: { id: user.id },
      select: { cbu: true, cbuTitular: true },
    });
    const cbuOk = (userBank?.cbu ?? "").trim().length > 0;
    const titularOk = (userBank?.cbuTitular ?? "").trim().length > 0;
    if (!cbuOk || !titularOk) {
      return NextResponse.json(
        {
          error: "Para solicitar el cobro tenés que cargar CBU o Alias y el titular de la cuenta en la sección «Datos para cobro».",
        },
        { status: 400 }
      );
    }

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

    if (balanceCents < MIN_PAYOUT_PESOS) {
      return NextResponse.json(
        {
          error: `El saldo mínimo para solicitar cobro es $${MIN_PAYOUT_PESOS.toFixed(2)}. Tu saldo actual es $${balanceCents.toFixed(2)}.`,
        },
        { status: 400 }
      );
    }

    // No permitir si ya hay una solicitud PENDING
    const pending = await prisma.referralPayoutRequest.findFirst({
      where: { referrerUserId: user.id, status: "PENDING" },
    });
    if (pending) {
      return NextResponse.json(
        { error: "Ya tenés una solicitud de cobro pendiente. Esperá a que sea procesada." },
        { status: 400 }
      );
    }

    const request = await prisma.referralPayoutRequest.create({
      data: {
        referrerUserId: user.id,
        amountCents: balanceCents,
        status: "PENDING",
      },
    });

    return NextResponse.json({
      ok: true,
      payoutRequest: {
        id: request.id,
        amountCents: request.amountCents,
        status: request.status,
        requestedAt: request.requestedAt.toISOString(),
      },
      message:
        "Tu solicitud de cobro fue registrada. Te pagaremos por Mercado Pago o transferencia en 24-48 h hábiles.",
    });
  } catch (err: any) {
    console.error("POST /api/referrals/me/request-payout ERROR >>>", err);
    return NextResponse.json(
      { error: "Error al solicitar cobro" },
      { status: 500 }
    );
  }
}
