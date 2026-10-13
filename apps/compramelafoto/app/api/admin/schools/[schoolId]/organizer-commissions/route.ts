import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolOrganizerManagementAccess } from "@/lib/school-organizer-management-access";
import {
  isCommissionPaidThenCancelled,
  ORGANIZER_COMMISSION_BASE_DESCRIPTION,
  summarizeOrganizerCommissions,
} from "@/lib/school-organizer-commission-logic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ schoolId: string }>;
};

function parseSchoolId(raw: string): number | null {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) return null;
  return value;
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const { schoolId: schoolIdRaw } = await params;
    const schoolId = parseSchoolId(schoolIdRaw);
    if (!schoolId) {
      return NextResponse.json({ error: "schoolId inválido" }, { status: 400 });
    }

    const access = await requireSchoolOrganizerManagementAccess({ schoolId });
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const commissionRows = await prisma.organizerCommission.findMany({
      where: { schoolId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        amount: true,
        percentage: true,
        baseAmount: true,
        status: true,
        createdAt: true,
        requestedAt: true,
        paidAt: true,
        paymentMethod: true,
        paymentProofUrl: true,
        organizerUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        album: {
          select: { id: true, title: true },
        },
        order: {
          select: { id: true },
        },
      },
    });

    // Totales separados por estado; "beneficio vigente" excluye anuladas y rechazadas.
    const summary = summarizeOrganizerCommissions(commissionRows);
    const commissions = commissionRows.map((row) => ({
      ...row,
      paidThenCancelled: isCommissionPaidThenCancelled(row),
    }));

    return NextResponse.json({
      summary,
      commissions,
      disclaimer: {
        calculation: ORGANIZER_COMMISSION_BASE_DESCRIPTION,
        payout:
          "La plataforma no realiza el pago. Es responsabilidad del fotógrafo.",
      },
    });
  } catch (err) {
    console.error("GET /api/admin/schools/[schoolId]/organizer-commissions:", err);
    return NextResponse.json({ error: "Error obteniendo comisiones de escuela" }, { status: 500 });
  }
}
