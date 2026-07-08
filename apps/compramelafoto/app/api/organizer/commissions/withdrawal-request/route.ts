import {
  EventOrganizerCommissionPayoutMode,
  EventOrganizerCommissionStatus,
  OrganizerCommissionWithdrawalStatus,
  Prisma,
  Role,
} from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { isOrganizerPayoutSettingsComplete } from "@/lib/organizer-withdrawal-payout-fields";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOG_PREFIX = "[organizer-commission-withdrawal]";

function decimalSum(rows: { organizerCommissionAmount: Prisma.Decimal }[]): Prisma.Decimal {
  let sum = new Prisma.Decimal(0);
  for (const r of rows) {
    sum = sum.plus(r.organizerCommissionAmount);
  }
  const rounded = Math.round(Number(sum) * 100) / 100;
  return new Prisma.Decimal(rounded.toFixed(2));
}

/**
 * POST /api/organizer/commissions/withdrawal-request
 * Usa los datos bancarios guardados en el perfil del organizador (snapshot en la solicitud).
 */
export async function POST() {
  try {
    const { error, user } = await requireAuth([Role.ORGANIZER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const profile = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        payoutAlias: true,
        payoutBank: true,
        payoutAccountHolder: true,
      },
    });

    if (!profile || !isOrganizerPayoutSettingsComplete(profile)) {
      return NextResponse.json(
        {
          error:
            "Antes de solicitar un retiro necesitás configurar una cuenta de cobro en «Datos para retiros».",
        },
        { status: 400 }
      );
    }

    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const eligible = await tx.eventOrganizerCommission.findMany({
        where: {
          event: { creatorId: user.id },
          organizerUserId: user.id,
          payoutMode: EventOrganizerCommissionPayoutMode.HELD_BY_PLATFORM,
          status: EventOrganizerCommissionStatus.AVAILABLE,
          availableAt: { lte: now },
          withdrawalRequestId: null,
        },
        select: {
          id: true,
          organizerCommissionAmount: true,
        },
      });

      if (eligible.length === 0) {
        return { ok: false as const, code: "no_eligible" as const };
      }

      const amount = decimalSum(eligible);
      if (Number(amount) <= 0) {
        return { ok: false as const, code: "zero_amount" as const };
      }

      const requestRow = await tx.organizerCommissionWithdrawalRequest.create({
        data: {
          organizerUserId: user.id,
          amount,
          status: OrganizerCommissionWithdrawalStatus.REQUESTED,
          payoutAliasSnapshot: profile.payoutAlias,
          payoutBankSnapshot: profile.payoutBank,
          payoutAccountHolderSnapshot: profile.payoutAccountHolder,
        },
      });

      const ids = eligible.map((e) => e.id);

      const updated = await tx.eventOrganizerCommission.updateMany({
        where: {
          id: { in: ids },
          event: { creatorId: user.id },
          organizerUserId: user.id,
          payoutMode: EventOrganizerCommissionPayoutMode.HELD_BY_PLATFORM,
          status: EventOrganizerCommissionStatus.AVAILABLE,
          availableAt: { lte: now },
          withdrawalRequestId: null,
        },
        data: {
          status: EventOrganizerCommissionStatus.WITHDRAWAL_REQUESTED,
          withdrawalRequestId: requestRow.id,
        },
      });

      if (updated.count !== eligible.length) {
        throw new Error("concurrent_withdrawal_conflict");
      }

      return {
        ok: true as const,
        requestId: requestRow.id,
        amount: Number(amount),
        commissionsCount: eligible.length,
      };
    });

    if (!result.ok) {
      if (result.code === "no_eligible") {
        return NextResponse.json(
          {
            error:
              "No hay comisiones disponibles para retirar. Solo se incluyen comisiones en estado disponible cuya fecha de disponibilidad ya venció.",
          },
          { status: 400 }
        );
      }
      if (result.code === "zero_amount") {
        return NextResponse.json({ error: "El monto total a retirar es inválido." }, { status: 400 });
      }
    }

    console.info(LOG_PREFIX, "created", {
      organizerUserId: user.id,
      requestId: result.requestId,
      amount: result.amount,
      commissionsCount: result.commissionsCount,
    });

    return NextResponse.json({
      ok: true,
      withdrawalRequestId: result.requestId,
      amount: result.amount,
      commissionsCount: result.commissionsCount,
    });
  } catch (err: unknown) {
    const msg = String((err as Error)?.message ?? err);
    if (msg.includes("concurrent_withdrawal_conflict")) {
      return NextResponse.json(
        { error: "No se pudo completar el retiro. Intentá de nuevo en unos segundos." },
        { status: 409 }
      );
    }
    console.error("POST /api/organizer/commissions/withdrawal-request ERROR >>>", err);
    return NextResponse.json(
      { error: "Error al crear la solicitud de retiro", detail: msg },
      { status: 500 }
    );
  }
}
