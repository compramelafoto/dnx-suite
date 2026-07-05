import { NextRequest, NextResponse } from "next/server";
import { OrganizerCommissionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSchoolOrganizerManagementAccess } from "@/lib/school-organizer-management-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ commissionId: string }>;
};

function parseCommissionId(raw: string): number | null {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) return null;
  return value;
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { commissionId: commissionIdRaw } = await params;
    const commissionId = parseCommissionId(commissionIdRaw);
    if (!commissionId) {
      return NextResponse.json({ error: "commissionId inválido" }, { status: 400 });
    }

    const commission = await prisma.organizerCommission.findUnique({
      where: { id: commissionId },
      select: { id: true, schoolId: true, status: true },
    });
    if (!commission) {
      return NextResponse.json({ error: "Comisión no encontrada" }, { status: 404 });
    }

    const access = await requireSchoolOrganizerManagementAccess({
      schoolId: commission.schoolId,
    });
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    if (commission.status !== OrganizerCommissionStatus.REQUESTED) {
      return NextResponse.json(
        { error: "Solo se pueden marcar como pagadas las comisiones solicitadas." },
        { status: 400 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      paymentMethod?: unknown;
      paymentProofUrl?: unknown;
    };

    const paymentMethod = String(body.paymentMethod ?? "").trim();
    const paymentProofUrl = String(body.paymentProofUrl ?? "").trim();

    const updated = await prisma.organizerCommission.update({
      where: { id: commissionId },
      data: {
        status: OrganizerCommissionStatus.PAID,
        paidAt: new Date(),
        paymentMethod: paymentMethod || null,
        paymentProofUrl: paymentProofUrl || null,
      },
      select: {
        id: true,
        status: true,
        paidAt: true,
        paymentMethod: true,
        paymentProofUrl: true,
      },
    });

    return NextResponse.json({ ok: true, commission: updated });
  } catch (err) {
    console.error("PATCH /api/admin/organizer-commissions/[commissionId]/mark-paid:", err);
    return NextResponse.json({ error: "Error marcando comisión como pagada" }, { status: 500 });
  }
}
