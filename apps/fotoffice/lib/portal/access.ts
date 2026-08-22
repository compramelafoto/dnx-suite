import { prisma } from "@repo/db";

/**
 * Autorización del portal del socio.
 *
 * Cuatro condiciones y ninguna más: sesión autenticada, ficha de socio cuyo `userId` es el de
 * esa sesión, el workspace al que pertenece esa ficha, y estado permitido.
 *
 * Deliberadamente NO interviene `WorkspaceMembership`. Los roles OWNER/ADMIN/STAFF describen
 * al equipo que administra la institución; un socio no es parte de ese equipo y agregarlo
 * como STAFF para "que entre" le daría permisos administrativos que no le corresponden.
 *
 * Nada se toma del navegador: el `userId` sale de la sesión y el workspace sale de la ficha.
 */

export type PortalContext = {
  member: { id: string; firstName: string; lastName: string; memberNumber: string };
  workspace: { id: string; name: string };
};

export async function loadPortalContext(userId: number): Promise<PortalContext | null> {
  const member = await prisma.member.findFirst({
    where: { userId, status: "ACTIVE" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      memberNumber: true,
      workspace: { select: { id: true, name: true } },
    },
    // Determinista si alguien es socio de más de una institución. El selector de institución
    // llega cuando exista el segundo caso real; hoy inventarlo sería adivinar la interfaz.
    orderBy: { createdAt: "asc" },
  });
  if (!member) return null;

  return {
    member: {
      id: member.id,
      firstName: member.firstName,
      lastName: member.lastName,
      memberNumber: member.memberNumber,
    },
    workspace: member.workspace,
  };
}
