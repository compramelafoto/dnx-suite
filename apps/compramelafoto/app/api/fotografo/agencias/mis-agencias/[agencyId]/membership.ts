import { NextResponse } from "next/server";
import { prisma, Role } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

/** Fotógrafo autenticado que es miembro ACTIVE de la agencia; si no, la respuesta de error lista para devolver. */
export async function requireActiveAgencyMember(
  params: Promise<{ agencyId: string }>
): Promise<{ res: NextResponse } | { agencyId: number; memberId: number }> {
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
  if (error || !user) return { res: NextResponse.json({ error: error || "No autorizado" }, { status: 401 }) };
  const id = Number((await params).agencyId);
  if (!Number.isInteger(id) || id <= 0) return { res: NextResponse.json({ error: "Agencia inválida." }, { status: 400 }) };
  const member = await prisma.agencyMember.findUnique({
    where: { agencyId_userId: { agencyId: id, userId: user.id } },
    select: { id: true, status: true },
  });
  if (!member || member.status !== "ACTIVE") {
    return { res: NextResponse.json({ error: "No sos parte del equipo de esa agencia." }, { status: 404 }) };
  }
  return { agencyId: id, memberId: member.id };
}
