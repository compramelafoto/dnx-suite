import { NextRequest, NextResponse } from "next/server";
import { prisma, Role } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { resolveAgencyTerms } from "@/lib/agencies/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ agencyId: string }> }) {
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
  if (error || !user) return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { acceptTerms?: unknown };
  if (body.acceptTerms !== true) {
    return NextResponse.json({ error: "Tenés que tildar que aceptás las condiciones." }, { status: 400 });
  }
  const { agencyId } = await Promise.resolve(params);
  const id = parseInt(agencyId, 10);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  const member = await prisma.agencyMember.findUnique({
    where: { agencyId_userId: { agencyId: id, userId: user.id } },
    select: { id: true, status: true, agency: { select: { termsVersion: true, termsText: true } } },
  });
  if (!member || member.status !== "ACTIVE") {
    return NextResponse.json({ error: "No sos parte del equipo de esa agencia." }, { status: 404 });
  }
  await prisma.agencyMember.update({
    where: { id: member.id },
    data: {
      termsVersionAccepted: member.agency.termsVersion,
      termsAcceptedAt: new Date(),
      termsAcceptedText: resolveAgencyTerms(member.agency),
    },
  });
  return NextResponse.json({ ok: true });
}
