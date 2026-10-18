import { NextRequest, NextResponse } from "next/server";
import { prisma, Role } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lugares frecuentes de la agencia, para que el fotógrafo elija dónde sacó las fotos. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ agencyId: string }> }) {
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
  if (error || !user) return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
  const { agencyId } = await params;
  const id = Number(agencyId);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Agencia inválida." }, { status: 400 });
  const member = await prisma.agencyMember.findUnique({
    where: { agencyId_userId: { agencyId: id, userId: user.id } },
    select: { status: true },
  });
  if (!member || member.status !== "ACTIVE") {
    return NextResponse.json({ error: "No sos parte del equipo de esa agencia." }, { status: 404 });
  }
  const places = await prisma.agencyPlace.findMany({
    where: { agencyId: id },
    orderBy: { name: "asc" },
    select: { id: true, name: true, lat: true, lng: true },
  });
  return NextResponse.json({ places });
}
