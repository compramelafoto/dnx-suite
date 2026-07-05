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

export async function POST(_req: NextRequest, { params }: RouteContext) {
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

    const result = await prisma.organizerCommission.updateMany({
      where: {
        schoolId,
        organizerUserId: access.user.id,
        status: OrganizerCommissionStatus.PENDING,
      },
      data: {
        status: OrganizerCommissionStatus.REQUESTED,
        requestedAt: new Date(),
      },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: "No hay comisiones pendientes para solicitar cobro." },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, updatedCount: result.count });
  } catch (err) {
    console.error("POST /api/school-organizer/schools/[schoolId]/commissions/request-payout:", err);
    return NextResponse.json({ error: "Error solicitando cobro" }, { status: 500 });
  }
}
