import { NextRequest, NextResponse } from "next/server";
import { OrganizerCommissionStatus } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { requireSchoolOrganizerAccess } from "@/lib/school-organizer-auth";

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

    const where = {
      schoolId,
      organizerUserId: access.user.id,
    } as const;

    const [rows, aggregatesByStatus] = await Promise.all([
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
          album: {
            select: { id: true, title: true },
          },
          order: {
            select: { id: true },
          },
        },
      }),
      prisma.organizerCommission.groupBy({
        by: ["status"],
        where,
        _sum: { amount: true },
      }),
    ]);

    const totals = {
      acumulado: 0,
      pendiente: 0,
      solicitado: 0,
      pagado: 0,
    };
    for (const row of aggregatesByStatus) {
      const amount = Number(row._sum.amount ?? 0);
      totals.acumulado += amount;
      if (row.status === OrganizerCommissionStatus.PENDING) totals.pendiente += amount;
      if (row.status === OrganizerCommissionStatus.REQUESTED) totals.solicitado += amount;
      if (row.status === OrganizerCommissionStatus.PAID) totals.pagado += amount;
    }

    return NextResponse.json({
      summary: totals,
      commissions: rows,
      disclaimer: {
        calculation:
          "La comisión se calcula sobre el precio del servicio sin incluir el costo de la plataforma.",
        payout:
          "La plataforma no realiza el pago. Es responsabilidad del fotógrafo.",
      },
    });
  } catch (err) {
    console.error("GET /api/school-organizer/schools/[schoolId]/commissions:", err);
    return NextResponse.json({ error: "Error obteniendo comisiones" }, { status: 500 });
  }
}
