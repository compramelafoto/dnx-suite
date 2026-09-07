import "server-only";
import { prisma } from "@repo/db";
import { PRINTED_CARD_PERIOD } from "./approve";
import { decimalArsToMinor } from "./money";

/**
 * ¿Este socio todavía debe su ingreso?
 *
 * Sirve para explicarle por qué no ve su carnet. Antes, quien acababa de ser aprobado entraba
 * al portal y leía «la institución todavía no emitió tu carnet», que es cierto pero deja
 * pensando que hay que esperar a que alguien haga algo: lo que falta, en realidad, es su
 * propio pago, y eso lo puede resolver él en dos clics.
 */
export type PendingEntry =
  | { pendiente: false }
  | { pendiente: true; totalMinor: number; expiresAt: Date | null };

export async function pendingEntryPayment(memberId: string): Promise<PendingEntry> {
  const solicitud = await prisma.membershipApplication.findFirst({
    where: { memberId, status: "APROBADA_IMPAGA" },
    select: { expiresAt: true },
  });
  if (!solicitud) return { pendiente: false };

  const cargos = await prisma.membershipCharge.findMany({
    where: {
      memberId,
      OR: [{ concept: "INGRESO" }, { concept: "OTRO", period: PRINTED_CARD_PERIOD }],
    },
    select: { balanceArs: true },
  });
  const totalMinor = cargos.reduce((t, c) => t + decimalArsToMinor(c.balanceArs), 0);
  if (totalMinor <= 0) return { pendiente: false };

  return { pendiente: true, totalMinor, expiresAt: solicitud.expiresAt };
}
