import "server-only";
import { prisma } from "@repo/db";

/**
 * ¿Este socio pidió la credencial impresa al asociarse y todavía no la tiene?
 *
 * La intención se declara en el formulario de asociación y hasta ahora quedaba ahí: nadie la
 * leía, así que el socio marcaba la casilla y no volvía a saber nada. Acá se la recupera para
 * poder recordárselo.
 *
 * No se pide la tarjeta sola al aprobar porque `requestPrintedCard` exige la foto, y la foto
 * se sube después. El orden real es: se aprueba, sube la foto, y recién ahí se puede pedir.
 */
export type PendingPrint =
  | { pedida: false }
  | { pedida: true; faltaFoto: boolean; yaEnCurso: boolean };

export async function pendingPrintedCard(memberId: string): Promise<PendingPrint> {
  const solicitud = await prisma.membershipApplication.findFirst({
    where: { memberId, wantsPrintedCard: true },
    select: { id: true },
  });
  if (!solicitud) return { pedida: false };

  const [socio, enCurso] = await Promise.all([
    prisma.member.findUnique({ where: { id: memberId }, select: { avatarUrl: true } }),
    prisma.memberCard.findFirst({
      where: {
        memberId,
        format: "PRINTED",
        revokedAt: null,
        fulfillmentState: { notIn: ["ENTREGADO", "ANULADO"] },
      },
      select: { id: true },
    }),
  ]);

  return {
    pedida: true,
    faltaFoto: !socio?.avatarUrl,
    yaEnCurso: Boolean(enCurso),
  };
}
