import "server-only";
import type { Prisma } from "@repo/db";
import { promoteFromWaitlist, rsvpTotals } from "@repo/muestras";

export type Promovida = { id: string; email: string | null; name: string };

/**
 * Pasa de la lista de espera a confirmadas a quienes entran en el cupo, en orden de llegada
 * (D16). Va **dentro** de la transacción que bloqueó la muestra (`FOR UPDATE`): así dos cambios
 * a la vez no pasan el cupo. Devuelve a quiénes pasó, para el correo "Se liberó un lugar", que se
 * manda después de la transacción.
 */
export async function promoverEnTx(tx: Prisma.TransactionClient, activityId: string, capacidad: number | null, ahora: Date = new Date()): Promise<Promovida[]> {
  const filas = await tx.culturalActivityRsvp.findMany({
    where: { activityId, status: { in: ["CONFIRMED", "WAITLIST"] } },
    select: { id: true, status: true, companions: true, email: true, name: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const espera = filas.filter((f) => f.status === "WAITLIST");
  if (espera.length === 0) return [];
  const ids = promoteFromWaitlist({ capacity: capacidad, confirmedPeople: rsvpTotals(filas).people, waitlist: espera });
  if (ids.length === 0) return [];
  await tx.culturalActivityRsvp.updateMany({ where: { id: { in: ids }, status: "WAITLIST" }, data: { status: "CONFIRMED", promotedAt: ahora } });
  const pasan = new Set(ids);
  return espera.filter((f) => pasan.has(f.id)).map((f) => ({ id: f.id, email: f.email, name: f.name }));
}
