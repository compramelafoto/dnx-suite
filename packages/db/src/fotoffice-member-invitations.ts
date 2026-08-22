/**
 * Flujo de invitación que se ENTRA desde un token público.
 *
 * Vive separado de `fotoffice-members.ts` porque allá rige el invariante de que toda función
 * recibe `workspaceId` primero, y acá eso es imposible por diseño: el workspace es la SALIDA
 * del token, no una entrada. Quien abre el enlace todavía no eligió workspace — el token es
 * justamente lo que determina a cuál pertenece. Forzar un `workspaceId` de entrada sería
 * pedirle al visitante que declare a qué institución quiere entrar, que es exactamente lo que
 * NO hay que hacer.
 *
 * El aislamiento se sostiene igual: el token es único e impredecible, y el workspaceId y
 * memberId salen de la propia fila, nunca de la URL.
 */
import { prisma } from "./client";
import { buildMemberAuditData, type MemberAuditActor } from "./fotoffice-member-audit";
import { MemberLinkError } from "./fotoffice-members";

/** Busca una invitación por el hash del token. El token crudo nunca toca la base. */
export function findInvitationByTokenHash(tokenHash: string) {
  return prisma.memberInvitation.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      workspaceId: true,
      memberId: true,
      email: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
      member: { select: { id: true, firstName: true, lastName: true, memberNumber: true, userId: true, status: true } },
      workspace: { select: { id: true, name: true } },
    },
  });
}

/**
 * Acepta la invitación y vincula, todo en una transacción.
 *
 * Contra dos aceptaciones simultáneas: el `updateMany` sobre la invitación exige que siga
 * `acceptedAt: null` y `revokedAt: null`. La segunda matchea 0 filas y aborta — sin esto, dos
 * clics a la vez podrían vincular dos veces.
 */
export async function acceptMemberInvitation(
  invitationId: string,
  userId: number,
  actor: MemberAuditActor,
): Promise<{ workspaceId: string; memberId: string }> {
  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const claimed = await tx.memberInvitation.updateMany({
      where: { id: invitationId, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
      data: { acceptedAt: now, acceptedByUserId: userId },
    });
    if (claimed.count !== 1) throw new MemberLinkError("INVITATION_INVALID");

    const inv = await tx.memberInvitation.findUnique({
      where: { id: invitationId },
      select: { workspaceId: true, memberId: true },
    });
    if (!inv) throw new MemberLinkError("INVITATION_INVALID");

    const member = await tx.member.findFirst({
      where: { id: inv.memberId, workspaceId: inv.workspaceId },
    });
    if (!member) throw new MemberLinkError("NOT_FOUND");
    if (member.userId !== null) throw new MemberLinkError("ALREADY_LINKED");

    const taken = await tx.member.findFirst({
      where: { workspaceId: inv.workspaceId, userId },
      select: { id: true },
    });
    if (taken) throw new MemberLinkError("USER_TAKEN");

    const linked = await tx.member.updateMany({
      where: { id: inv.memberId, workspaceId: inv.workspaceId, userId: null },
      data: { userId },
    });
    if (linked.count !== 1) throw new MemberLinkError("ALREADY_LINKED");

    // Dos eventos, no uno: aceptar la invitación y quedar vinculado son cosas distintas y el
    // historial tiene que poder distinguirlas.
    await tx.memberAudit.create({
      data: buildMemberAuditData(inv.workspaceId, inv.memberId, {
        action: "INVITE_ACCEPTED",
        source: "SYSTEM",
        actor,
        reason: "El socio aceptó la invitación de acceso",
      }),
    });
    await tx.memberAudit.create({
      data: buildMemberAuditData(inv.workspaceId, inv.memberId, {
        action: "USER_LINKED",
        source: "SYSTEM",
        actor,
        changes: { userId: { before: null, after: userId } },
        reason: "Invitación aceptada por el socio",
      }),
    });

    return inv;
  });
}
