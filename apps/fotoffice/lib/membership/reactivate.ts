import "server-only";
import { prisma } from "@repo/db";
import { generateMonthlyCharges } from "./generate-monthly";
import { periodOf } from "./monthly-plan";

/**
 * Reactivación de un socio dado de baja.
 *
 * Dos caminos llegan acá: la Secretaría que lo reactiva a mano y el propio socio que paga su
 * deuda desde la puerta de la institución. Los dos comparten el mismo agujero, y por eso la
 * misma reparación: `ensureCurrentPeriodCharge`.
 */

/**
 * Le genera la cuota del mes en curso si la generación de este mes ya corrió sin él.
 *
 * La generación mensual sólo mira a los socios que no están de baja *el día que corre*. Quien
 * vuelve después se queda sin la cuota de ese mes para siempre: el mes siguiente se genera el
 * siguiente. No figura debiendo, así que nadie lo detecta por el lado de la mora.
 *
 * Sólo actúa si la institución ya generó este período para alguien: si todavía no corrió, la
 * generación del día lo va a incluir sola, y en una institución sin cuotas no hay nada que
 * generar. Es idempotente por la clave única `[memberId, concept, period]`.
 */
export async function ensureCurrentPeriodCharge(input: {
  workspaceId: string;
  memberId: string;
  now?: Date;
}): Promise<void> {
  const period = periodOf(input.now ?? new Date());
  const yaCorrio = await prisma.membershipCharge.findFirst({
    where: { workspaceId: input.workspaceId, concept: "MENSUAL", period },
    select: { id: true },
  });
  if (!yaCorrio) return;

  await generateMonthlyCharges({
    workspaceId: input.workspaceId,
    period,
    memberIds: [input.memberId],
  });
}

export type ReactivationResult = "REACTIVATED" | "NOT_INACTIVE" | "STILL_OWES";

/**
 * Reactiva al socio dado de baja que ya no debe nada.
 *
 * Se llama después de acreditar un pago de Mercado Pago. Un socio de baja no tiene portal, así
 * que el único pago en línea que puede llegar a hacer es el de la puerta, que es justamente el
 * de "pagar y reactivar". Si pagó de menos —o entre medio apareció otra deuda— sigue de baja:
 * la regla es la deuda en cero, no "pagó algo".
 *
 * El cambio de estado se condiciona a que siga `INACTIVE` al escribir: si la Secretaría lo
 * reactivó mientras tanto, no se pisa ni se duplica la auditoría.
 */
export async function reactivateIfDebtCleared(memberId: string): Promise<ReactivationResult> {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { id: true, workspaceId: true, status: true, leftAt: true },
  });
  if (!member || member.status !== "INACTIVE") return "NOT_INACTIVE";

  const debe = await prisma.membershipCharge.findFirst({
    where: { memberId, balanceArs: { gt: 0 } },
    select: { id: true },
  });
  if (debe) return "STILL_OWES";

  const hecho = await prisma.$transaction(async (tx) => {
    const r = await tx.member.updateMany({
      where: { id: memberId, status: "INACTIVE" },
      data: { status: "ACTIVE", leftAt: null },
    });
    if (r.count === 0) return false;
    await tx.memberAudit.create({
      data: {
        workspaceId: member.workspaceId,
        memberId,
        action: "STATUS_CHANGED",
        source: "SYSTEM",
        actorLabel: "El propio socio",
        changesJson: {
          status: { before: "INACTIVE", after: "ACTIVE" },
          leftAt: { before: member.leftAt?.toISOString() ?? null, after: null },
        },
        reason: "Reactivado al pagar su deuda en línea",
      },
    });
    return true;
  });
  if (!hecho) return "NOT_INACTIVE";

  try {
    await ensureCurrentPeriodCharge({ workspaceId: member.workspaceId, memberId });
  } catch (error) {
    // La reactivación ya es cierta; la cuota que falte se puede generar a mano.
    console.error("[fotoffice][reactivacion] no se pudo generar la cuota del mes", {
      memberId,
      detalle: error instanceof Error ? error.message : String(error),
    });
  }
  return "REACTIVATED";
}
