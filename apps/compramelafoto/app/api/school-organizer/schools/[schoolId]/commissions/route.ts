import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolOrganizerAccess } from "@/lib/school-organizer-auth";
import {
  buildSchoolPortalCommissionWhere,
  isCommissionPaidThenCancelled,
  isCommissionRequestableBy,
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

    const access = await requireSchoolOrganizerAccess({ schoolId });
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    // Todas las comisiones de ESTA escuela (cualquier organizador activo de la escuela las ve).
    // El acceso ya verificó membresía ACTIVE en schoolId; el where siempre fija ese schoolId.
    const where = buildSchoolPortalCommissionWhere(schoolId);

    const [rows, activeOrganizers] = await Promise.all([
      prisma.organizerCommission.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          amount: true,
          baseAmount: true,
          percentage: true,
          status: true,
          createdAt: true,
          requestedAt: true,
          paidAt: true,
          paymentMethod: true,
          paymentProofUrl: true,
          organizerUserId: true,
          album: {
            select: { id: true, title: true },
          },
          order: {
            select: { id: true, status: true, origin: true },
          },
        },
      }),
      prisma.schoolOrganizer.findMany({
        where: { schoolId, status: "ACTIVE" },
        select: { userId: true },
      }),
    ]);

    const activeOrganizerUserIds = activeOrganizers.map((o) => o.userId);
    const totals = summarizeOrganizerCommissions(rows);
    const commissions = rows.map(({ organizerUserId, ...row }) => ({
      ...row,
      paidThenCancelled: isCommissionPaidThenCancelled(row),
      assignedToMe: organizerUserId === access.user.id,
      requestableByMe: isCommissionRequestableBy(
        { status: row.status, organizerUserId },
        { userId: access.user.id, activeOrganizerUserIds }
      ),
    }));

    return NextResponse.json({
      summary: totals,
      commissions,
      disclaimer: {
        calculation: ORGANIZER_COMMISSION_BASE_DESCRIPTION,
        payout:
          "La plataforma no realiza el pago. Es responsabilidad del fotógrafo.",
      },
    });
  } catch (err) {
    console.error("GET /api/school-organizer/schools/[schoolId]/commissions:", err);
    return NextResponse.json({ error: "Error obteniendo comisiones" }, { status: 500 });
  }
}
