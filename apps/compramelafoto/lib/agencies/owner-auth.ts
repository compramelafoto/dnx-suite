import { NextResponse } from "next/server";
import { prisma, Role } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

/** Sesión de fotógrafo + su agencia. Devuelve una respuesta de error lista si falta algo. */
export async function requireOwnedAgency() {
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
  if (error || !user) return { res: NextResponse.json({ error: error || "No autorizado" }, { status: 401 }) } as const;
  const agency = await prisma.agency.findUnique({ where: { ownerUserId: user.id } });
  if (!agency) return { res: NextResponse.json({ error: "Todavía no creaste tu agencia." }, { status: 404 }) } as const;
  return { user, agency } as const;
}
