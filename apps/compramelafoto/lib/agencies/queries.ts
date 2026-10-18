import { prisma } from "@/lib/prisma";

/** Acceso a datos del modo agencia que reutilizan las rutas y la compuerta de subida. */

export async function findAgencyAlbumGate(
  albumId: number
): Promise<{ agencyId: number; ownerUserId: number; termsVersion: number } | null> {
  const row = await prisma.agencyAlbum.findUnique({
    where: { albumId },
    select: { agencyId: true, agency: { select: { ownerUserId: true, termsVersion: true } } },
  });
  if (!row) return null;
  return { agencyId: row.agencyId, ownerUserId: row.agency.ownerUserId, termsVersion: row.agency.termsVersion };
}

export async function findMembership(
  agencyId: number,
  userId: number
): Promise<{ id: number; status: string; termsVersionAccepted: number | null; commissionBps: number | null } | null> {
  return prisma.agencyMember.findUnique({
    where: { agencyId_userId: { agencyId, userId } },
    select: { id: true, status: true, termsVersionAccepted: true, commissionBps: true },
  });
}
