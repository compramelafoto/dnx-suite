import { prisma } from "@repo/db";

/**
 * Para qué lado de FotoOffice es esta persona.
 *
 * Existe por un defecto concreto: `ensureFotofficeWorkspaceForUser` le CREA un workspace a
 * quien no tiene ninguno, con esa persona como `WORKSPACE_OWNER`. Es lo correcto para un
 * fotógrafo que recién llega, y exactamente lo contrario de lo que hay que hacerle a un
 * socio: si los 152 socios de SFPR activaran su acceso, tendríamos 152 instituciones vacías.
 *
 * Por eso hay que saber de quién se trata ANTES de llamar a esa función, no después.
 */

export type FotofficeUserKind =
  /** Integra el equipo de algún workspace (OWNER/ADMIN/STAFF). Va al panel administrativo. */
  | "TEAM"
  /** Es socio de una institución, sin rol de equipo. Va al portal del socio. */
  | "MEMBER"
  /** No es ninguna de las dos cosas: fotógrafo nuevo, se le prepara su workspace. */
  | "NEW";

export async function resolveFotofficeUserKind(userId: number): Promise<FotofficeUserKind> {
  const [unified, legacy] = await Promise.all([
    prisma.workspaceMembership.count({ where: { userId } }),
    prisma.membership.count({ where: { userId } }),
  ]);
  // Ser equipo gana: alguien puede ser fotógrafo con workspace propio y además socio.
  if (unified > 0 || legacy > 0) return "TEAM";

  const member = await prisma.member.findFirst({
    where: { userId, status: "ACTIVE" },
    select: { id: true },
  });
  return member ? "MEMBER" : "NEW";
}
