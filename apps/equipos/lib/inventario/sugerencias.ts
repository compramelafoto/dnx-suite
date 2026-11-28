import { prisma } from "@repo/db";

export type SightingSuggestion = {
  sightingId: number;
  kind: "BODY" | "LENS";
  make: string;
  model: string;
  serialRaw: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
  photosCount: number;
};

/**
 * Equipos que CompraMeLaFoto vio en las fotos de esta persona (mismo `User.id`) y que todavía
 * no confirmó ni descartó.
 */
export async function listSightingSuggestions(userId: number): Promise<SightingSuggestion[]> {
  const dismissed = await prisma.gearSightingDismissal.findMany({
    where: { userId },
    select: { sightingId: true },
  });
  const rows = await prisma.gearSerialSighting.findMany({
    where: {
      photographerId: userId,
      id: { notIn: dismissed.map((d) => d.sightingId) },
      gearItem: { is: null },
    },
    orderBy: { lastSeenAt: "desc" },
  });
  return rows.map((r) => ({
    sightingId: r.id,
    kind: r.kind,
    make: r.make,
    model: r.model,
    serialRaw: r.serialRaw,
    firstSeenAt: r.firstSeenAt,
    lastSeenAt: r.lastSeenAt,
    photosCount: r.photosCount,
  }));
}
