import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSchoolOrganizerManagementAccess } from "@/lib/school-organizer-management-access";

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

    const [commissions, aggregatesByStatus] = await Promise.all([
      prisma.organizerCommission.findMany({
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
      }),
      prisma.organizerCommission.groupBy({
        by: ["status"],
        where: { schoolId },
        _sum: { amount: true },
      }),
    ]);

    const summary = {
      acumulado: 0,
      pendiente: 0,
      solicitado: 0,
      pagado: 0,
    };
    for (const row of aggregatesByStatus) {
      const amount = Number(row._sum.amount ?? 0);
      summary.acumulado += amount;
      if (row.status === "PENDING") summary.pendiente += amount;
      if (row.status === "REQUESTED") summary.solicitado += amount;
      if (row.status === "PAID") summary.pagado += amount;
    }

    return NextResponse.json({
      summary,
      commissions,
      disclaimer: {
        calculation:
          "La comisión se calcula sobre el precio del servicio sin incluir el costo de la plataforma.",
        payout:
          "La plataforma no realiza el pago. Es responsabilidad del fotógrafo.",
      },
    });
  } catch (err) {
    console.error("GET /api/admin/schools/[schoolId]/organizer-commissions:", err);
    return NextResponse.json({ error: "Error obteniendo comisiones de escuela" }, { status: 500 });
  }
}
