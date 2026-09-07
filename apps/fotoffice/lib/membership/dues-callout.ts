import "server-only";
import { prisma } from "@repo/db";
import { APERTURA_PERIOD, fechaLegible } from "./charge-labels";
import { decimalArsToMinor, formatMinorArs } from "./money";

/**
 * La cuota que el email de invitación va a mencionar.
 *
 * `null` cuando el socio no tiene ninguna abierta —un honorario, por ejemplo—, y entonces el
 * email no habla de pagos: invitar a alguien a "entrar a pagar su cuota" para que se
 * encuentre con un cartel de "estás al día" es una promesa incumplida.
 *
 * Se excluye el arrastre del sistema anterior a propósito. Es el saldo migrado, que para una
 * parte del padrón no reconcilia; anunciarlo en el primer email que recibe el socio sería la
 * peor presentación posible del portal. Que lo vea adentro, etiquetado y con el canal de
 * reclamo al lado.
 */
export type DuesCallout = {
  period: string;
  amountLabel: string;
  dueDateLabel: string;
};

export async function loadDuesCallout(memberId: string): Promise<DuesCallout | null> {
  const charge = await prisma.membershipCharge.findFirst({
    where: {
      memberId,
      balanceArs: { gt: 0 },
      period: { not: APERTURA_PERIOD },
    },
    select: { period: true, balanceArs: true, dueDate: true },
    // La más próxima a vencer: es la que el socio tiene que pagar primero.
    orderBy: { dueDate: "asc" },
  });
  if (!charge) return null;

  return {
    period: charge.period,
    amountLabel: formatMinorArs(decimalArsToMinor(charge.balanceArs)),
    dueDateLabel: fechaLegible(charge.dueDate),
  };
}
