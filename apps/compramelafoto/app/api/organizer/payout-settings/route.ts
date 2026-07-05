import { Role } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  isOrganizerPayoutSettingsComplete,
  validateOrganizerPayoutSettingsInput,
} from "@/lib/organizer-withdrawal-payout-fields";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mapUserPayout(user: {
  payoutAlias: string | null;
  payoutBank: string | null;
  payoutAccountHolder: string | null;
}) {
  return {
    payoutAlias: user.payoutAlias,
    payoutBank: user.payoutBank,
    payoutAccountHolder: user.payoutAccountHolder,
    isComplete: isOrganizerPayoutSettingsComplete(user),
  };
}

/**
 * GET /api/organizer/payout-settings
 */
export async function GET() {
  try {
    const { error, user } = await requireAuth([Role.ORGANIZER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const row = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        payoutAlias: true,
        payoutBank: true,
        payoutAccountHolder: true,
      },
    });

    if (!row) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    return NextResponse.json(mapUserPayout(row));
  } catch (err: unknown) {
    console.error("GET /api/organizer/payout-settings ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo datos bancarios", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/organizer/payout-settings
 */
export async function PATCH(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.ORGANIZER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const validation = validateOrganizerPayoutSettingsInput(body);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        payoutAlias: validation.data.payoutAlias,
        payoutBank: validation.data.payoutBank,
        payoutAccountHolder: validation.data.payoutAccountHolder,
      },
      select: {
        payoutAlias: true,
        payoutBank: true,
        payoutAccountHolder: true,
      },
    });

    return NextResponse.json(mapUserPayout(updated));
  } catch (err: unknown) {
    console.error("PATCH /api/organizer/payout-settings ERROR >>>", err);
    return NextResponse.json(
      { error: "Error guardando datos bancarios", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}
