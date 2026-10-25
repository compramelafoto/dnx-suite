import "server-only";
import { prisma } from "@repo/db";
import { PRINTED_CARD_PERIOD } from "@/lib/membership/charge-labels";
import { decimalArsToMinor } from "@/lib/membership/money";
import { reusablePrintOrderCharge } from "./reusable-charge";

/**
 * Socios que pagaron la tarjeta impresa y todavía no la tienen emitida.
 *
 * Hasta ahora la única forma de emitirla era que el socio la pidiera desde su portal o
 * subiera la foto. Quien la pagó por fuera del sistema —o la tenía paga de antes— quedaba
 * esperando algo que nadie del panel podía destrabar.
 *
 * Usa la misma regla que el pedido (`reusablePrintOrderCharge`) para decidir si hay un cargo
 * pagado libre: lo que se muestra acá es exactamente lo que el botón va a poder emitir.
 */
export type PrepaidUnissued = {
  memberId: string;
  memberNumber: string;
  fullName: string;
  hasPhoto: boolean;
};

export async function loadPrepaidUnissuedCards(workspaceId: string): Promise<PrepaidUnissued[]> {
  const cargos = await prisma.membershipCharge.findMany({
    where: {
      workspaceId,
      concept: "OTRO",
      period: { startsWith: PRINTED_CARD_PERIOD },
      balanceArs: { lte: 0 },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, memberId: true, balanceArs: true },
  });
  if (cargos.length === 0) return [];

  const memberIds = [...new Set(cargos.map((c) => c.memberId))];
  const [tomados, enCurso, socios] = await Promise.all([
    prisma.memberCard.findMany({
      where: {
        printOrderChargeId: { in: cargos.map((c) => c.id) },
        fulfillmentState: { not: "ANULADO" },
      },
      select: { printOrderChargeId: true },
    }),
    // Con una tarjeta en camino el pedido rebota ("ya tenés una"): no se ofrece el botón.
    prisma.memberCard.findMany({
      where: {
        memberId: { in: memberIds },
        format: "PRINTED",
        revokedAt: null,
        fulfillmentState: { notIn: ["ENTREGADO", "ANULADO"] },
        validUntil: { gt: new Date() },
      },
      select: { memberId: true },
    }),
    prisma.member.findMany({
      where: { id: { in: memberIds }, workspaceId, status: "ACTIVE" },
      select: { id: true, memberNumber: true, firstName: true, lastName: true, avatarUrl: true },
      orderBy: { memberNumber: "asc" },
    }),
  ]);

  const takenChargeIds = tomados.map((t) => t.printOrderChargeId as string);
  const conTarjetaEnCamino = new Set(enCurso.map((c) => c.memberId));

  return socios
    .filter((s) => !conTarjetaEnCamino.has(s.id))
    .filter((s) =>
      reusablePrintOrderCharge({
        charges: cargos
          .filter((c) => c.memberId === s.id)
          .map((c) => ({ id: c.id, balanceMinor: decimalArsToMinor(c.balanceArs) })),
        takenChargeIds,
      }),
    )
    .map((s) => ({
      memberId: s.id,
      memberNumber: s.memberNumber,
      fullName: `${s.firstName} ${s.lastName}`.trim(),
      hasPhoto: Boolean(s.avatarUrl),
    }));
}
