import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnedAgency } from "@/lib/agencies/owner-auth";
import { parseCommissionPercent } from "@/lib/agencies/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
  const a = await requireOwnedAgency();
  if ("res" in a) return a.res;
  const { memberId } = await Promise.resolve(params);
  const id = parseInt(memberId, 10);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const member = await prisma.agencyMember.findFirst({ where: { id, agencyId: a.agency.id } });
  if (!member) return NextResponse.json({ error: "No encontramos a ese fotógrafo en tu agencia." }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { action?: string; percent?: unknown };
  switch (body.action) {
    case "setCommission": {
      const p = parseCommissionPercent(body.percent, { allowEmpty: true });
      if (!p.ok) return NextResponse.json({ error: p.error }, { status: 400 });
      await prisma.agencyMember.update({ where: { id }, data: { commissionBps: p.bps } });
      return NextResponse.json({ ok: true });
    }
    case "accept": {
      if (member.status !== "REQUESTED") return NextResponse.json({ error: "Esa solicitud ya no está pendiente." }, { status: 409 });
      await prisma.agencyMember.update({ where: { id }, data: { status: "ACTIVE", joinedAt: new Date(), removedAt: null } });
      return NextResponse.json({ ok: true });
    }
    case "reject": {
      if (member.status !== "REQUESTED") return NextResponse.json({ error: "Esa solicitud ya no está pendiente." }, { status: 409 });
      await prisma.agencyMember.update({ where: { id }, data: { status: "REJECTED" } });
      return NextResponse.json({ ok: true });
    }
    case "remove": {
      if (member.status !== "ACTIVE") return NextResponse.json({ error: "Ese fotógrafo no está activo." }, { status: 409 });
      const now = new Date();
      await prisma.$transaction([
        prisma.agencyMember.update({ where: { id }, data: { status: "REMOVED", removedAt: now } }),
        prisma.agencyUploadCredential.updateMany({ where: { memberId: member.id, revokedAt: null }, data: { revokedAt: now } }),
      ]);
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
  }
}
