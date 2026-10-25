import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { RSVP_RETENTION_DAYS, rsvpPurgeDue, rsvpTotals } from "@repo/muestras";

const DIA = 24 * 60 * 60 * 1000;

/** Borra los datos personales de la asistencia y deja sólo los totales (D21). Idempotente. */
export async function purgarAsistencias(activityId: string, ahora: Date): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const filas = await tx.culturalActivityRsvp.findMany({ where: { activityId }, select: { status: true, companions: true } });
    // Sólo la primera vez se escribe el resumen; si ya estaba marcada (otra limpieza en paralelo),
    // igual se borra lo que haya quedado.
    await tx.culturalActivity.updateMany({
      where: { id: activityId, rsvpPurgedAt: null },
      data: { rsvpSummary: rsvpTotals(filas) as unknown as Prisma.InputJsonValue, rsvpPurgedAt: ahora },
    });
    await tx.culturalActivityRsvp.deleteMany({ where: { activityId } });
  });
}

/** Muestras cerradas hace más de 30 días que todavía tienen datos de asistencia. Devuelve cuántas. */
export async function barrerAsistenciasVencidas(ahora: Date, { tope = 50 }: { tope?: number } = {}): Promise<number> {
  const vencidas = await prisma.culturalActivity.findMany({
    where: { endsAt: { lt: new Date(ahora.getTime() - RSVP_RETENTION_DAYS * DIA) }, rsvpPurgedAt: null, rsvps: { some: {} } },
    select: { id: true, endsAt: true },
    take: tope,
  });
  let n = 0;
  for (const a of vencidas) {
    if (!rsvpPurgeDue(a.endsAt, ahora)) continue;
    await purgarAsistencias(a.id, ahora);
    n++;
  }
  return n;
}

let ultimaPasada = 0;

/** Limpieza perezosa (D22): como mucho una vez cada 6 h por instancia. Nunca tira. */
export async function barrerSiToca(ahora: Date = new Date()): Promise<void> {
  if (ultimaPasada && ahora.getTime() - ultimaPasada < 6 * 60 * 60 * 1000) return;
  ultimaPasada = ahora.getTime();
  try {
    await barrerAsistenciasVencidas(ahora);
  } catch (err) {
    console.error("[asistencia] limpieza:", err instanceof Error ? err.message : String(err));
  }
}
