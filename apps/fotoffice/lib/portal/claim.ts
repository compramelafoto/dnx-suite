import "server-only";
import { prisma } from "@repo/db";

/**
 * Reconocer al socio que ya tenía usuario.
 *
 * La identidad es global en el monorepo: alguien puede tener cuenta por InfoSpot o
 * ComprameLaFoto y ser, además, socio de una institución. Hasta ahora la única forma de unir
 * las dos cosas era aceptar una invitación. Quien iniciaba sesión por su cuenta caía como
 * "usuario nuevo" y se le ofrecía crear su propio negocio — que es exactamente lo contrario de
 * lo que necesita un socio.
 *
 * El vínculo se ofrece cuando el email de la sesión coincide con el de una ficha de socio
 * activa sin vincular. Iniciar sesión ya probó el control de ese email, que es el mismo
 * estándar que exige la invitación.
 */

export type ClaimableMembership = {
  memberId: string;
  memberNumber: string;
  firstName: string;
  lastName: string;
  workspaceName: string;
};

export async function findClaimableMembership(input: {
  userId: number;
  email: string;
}): Promise<ClaimableMembership | null> {
  const email = input.email.trim().toLowerCase();
  if (!email) return null;

  const member = await prisma.member.findFirst({
    where: {
      status: "ACTIVE",
      userId: null,
      email: { equals: email, mode: "insensitive" },
    },
    select: {
      id: true,
      memberNumber: true,
      firstName: true,
      lastName: true,
      workspace: { select: { name: true } },
    },
    // Determinista si alguien figura en más de una institución con el mismo email.
    orderBy: { createdAt: "asc" },
  });
  if (!member) return null;

  return {
    memberId: member.id,
    memberNumber: member.memberNumber,
    firstName: member.firstName,
    lastName: member.lastName,
    workspaceName: member.workspace.name,
  };
}

export type ClaimResult = { ok: true; memberId: string } | { ok: false; error: string };

/**
 * Vincula la ficha con el usuario de la sesión.
 *
 * Transaccional y con protección contra concurrencia: se exige que `userId` siga en `null` al
 * momento de escribir, así dos pestañas abiertas no producen dos vinculaciones.
 */
export async function claimMembership(input: {
  userId: number;
  email: string;
  memberId: string;
}): Promise<ClaimResult> {
  const candidato = await findClaimableMembership({ userId: input.userId, email: input.email });
  if (!candidato || candidato.memberId !== input.memberId) {
    return { ok: false, error: "Esa ficha de socio ya no está disponible para vincular." };
  }

  const actualizados = await prisma.member.updateMany({
    where: { id: input.memberId, userId: null, status: "ACTIVE" },
    data: { userId: input.userId },
  });
  if (actualizados.count === 0) {
    return { ok: false, error: "Alguien vinculó esa ficha mientras confirmabas. Volvé a entrar." };
  }

  const member = await prisma.member.findUnique({
    where: { id: input.memberId },
    select: { workspaceId: true },
  });
  if (member) {
    await prisma.memberAudit.create({
      data: {
        workspaceId: member.workspaceId,
        memberId: input.memberId,
        action: "USER_LINKED",
        source: "SYSTEM",
        actorUserId: input.userId,
        actorLabel: "El propio socio",
        reason: "Reconocido por coincidencia de email al iniciar sesión",
      },
    });
  }

  return { ok: true, memberId: input.memberId };
}
