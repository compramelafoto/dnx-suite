import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeGearSerial } from "@/lib/stolen-gear/serial";

/** Sólo administradores. Devuelve el usuario o la respuesta 403 lista para devolver. */
export async function requireStolenGearAdmin() {
  const user = await getAuthUser();
  if (!user || (user.role !== "ADMIN" && String(user.role) !== "SUPER_ADMIN")) {
    return { user: null, denied: NextResponse.json({ error: "No autorizado" }, { status: 403 }) };
  }
  return { user, denied: null };
}

const userCard = { select: { id: true, name: true, email: true, phone: true } } as const;

export async function getStolenGearAdminOverview() {
  const [reports, matches] = await Promise.all([
    prisma.stolenGearReport.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: 300,
      include: {
        reporter: userCard,
        reviewedBy: { select: { id: true, name: true } },
        _count: { select: { matches: true } },
      },
    }),
    prisma.stolenGearMatch.findMany({
      orderBy: [{ detectedAt: "desc" }],
      take: 300,
      include: {
        report: {
          select: {
            id: true,
            kind: true,
            make: true,
            model: true,
            serialRaw: true,
            stolenAt: true,
            status: true,
            reporter: userCard,
          },
        },
        sighting: {
          include: { photographer: userCard },
        },
      },
    }),
  ]);
  return { reports, matches };
}

/**
 * Historial completo de un número de serie: todas las cuentas que lo usaron y cuándo,
 * más las denuncias que lo mencionan. Es el "buscador privado".
 */
export async function searchSerialHistory(rawSerial: string) {
  const serialNormalized = normalizeGearSerial(rawSerial);
  if (!serialNormalized) return { serialNormalized: null, sightings: [], reports: [] };
  const [sightings, reports] = await Promise.all([
    prisma.gearSerialSighting.findMany({
      where: { serialNormalized },
      orderBy: { firstSeenAt: "asc" },
      include: { photographer: userCard },
    }),
    prisma.stolenGearReport.findMany({
      where: { serialNormalized },
      orderBy: { createdAt: "desc" },
      select: { id: true, kind: true, make: true, model: true, status: true, stolenAt: true, reporter: userCard },
    }),
  ]);
  return { serialNormalized, sightings, reports };
}
