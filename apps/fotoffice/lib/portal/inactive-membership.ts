import "server-only";
import { prisma } from "@repo/db";
import { loadMemberBalance } from "@/lib/membership/balance";

/**
 * El socio de baja que llega a la puerta de su institución.
 *
 * Antes la puerta sólo buscaba fichas activas, así que a quien estaba de baja le decía "no te
 * encontramos": falso, y lo mandaba a probar con otro correo o a crearse otra cuenta. Pasó con
 * el socio 714 de la SFPR el 2026-10-05.
 *
 * Se lo reconoce igual que en el reconocimiento por email (`lib/portal/claim.ts`): ficha de
 * esta institución que ya es suya, o sin vincular y con el mismo correo que la sesión —iniciar
 * sesión ya probó que el correo es suyo—. Encontrarlo NO le abre nada: el portal sigue
 * exigiendo una ficha activa.
 */

export type InactiveMembership = {
  memberId: string;
  memberNumber: string;
  firstName: string;
  /** Si la ficha todavía no estaba vinculada a esta cuenta. */
  unlinked: boolean;
  /** Lo que debe, en centavos (sin descontar saldo a favor). */
  dueMinor: number;
  /** Lo que tendría que pagar para quedar en cero: la deuda menos el saldo a favor. */
  netMinor: number;
  openCharges: number;
};

export async function findInactiveMembership(input: {
  workspaceId: string;
  userId: number;
  email: string;
}): Promise<InactiveMembership | null> {
  const email = input.email.trim().toLowerCase();
  const member = await prisma.member.findFirst({
    where: {
      workspaceId: input.workspaceId,
      status: "INACTIVE",
      OR: [
        { userId: input.userId },
        ...(email ? [{ userId: null, email: { equals: email, mode: "insensitive" as const } }] : []),
      ],
    },
    select: { id: true, memberNumber: true, firstName: true, userId: true },
    // La propia antes que una por coincidencia de correo.
    orderBy: [{ userId: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
  });
  if (!member) return null;

  const cuenta = await loadMemberBalance(member.id);
  return {
    memberId: member.id,
    memberNumber: member.memberNumber,
    firstName: member.firstName,
    unlinked: member.userId === null,
    dueMinor: cuenta.dueMinor,
    netMinor: cuenta.netMinor,
    openCharges: cuenta.charges.length,
  };
}

/**
 * Vincula la ficha de baja a la cuenta de la sesión, si estaba sin vincular.
 *
 * Se hace cuando la persona actúa (paga o pide que la contacten), no al mirar: así, cuando la
 * ficha vuelva a estar activa —sola o a mano—, entra directo al portal sin otro paso. Mismo
 * resguardo que el reconocimiento: `userId: null` al escribir, y la restricción
 * `[workspaceId, userId]` impide que una cuenta tenga dos fichas en la misma institución.
 */
export async function linkInactiveMembership(input: {
  memberId: string;
  workspaceId: string;
  userId: number;
}): Promise<void> {
  try {
    const r = await prisma.member.updateMany({
      where: { id: input.memberId, workspaceId: input.workspaceId, userId: null, status: "INACTIVE" },
      data: { userId: input.userId },
    });
    if (r.count === 0) return;
    await prisma.memberAudit.create({
      data: {
        workspaceId: input.workspaceId,
        memberId: input.memberId,
        action: "USER_LINKED",
        source: "SYSTEM",
        actorUserId: input.userId,
        actorLabel: "El propio socio",
        reason: "Reconocido por coincidencia de email al pedir la reactivación",
      },
    });
  } catch (error) {
    // Ya tiene otra ficha en esta institución con esta cuenta: no se vincula, y no hace falta
    // para pagar ni para avisar.
    console.error("[fotoffice][reactivacion] no se pudo vincular la ficha", {
      memberId: input.memberId,
      detalle: error instanceof Error ? error.message : String(error),
    });
  }
}
