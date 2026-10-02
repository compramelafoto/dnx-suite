import "server-only";
import { prisma } from "@repo/db";
import { puede } from "@/lib/access/policy";

/**
 * Quiénes pueden recibir permisos sobre los carnets.
 *
 * Solo gente que **ya pertenece al workspace**. Otorgarle permisos a alguien de afuera no
 * serviría: sin membresía no puede entrar al panel, así que el permiso quedaría escrito y
 * sin efecto. Sumar colaboradores externos —el caso del impresor de otra empresa— es una
 * necesidad distinta y merece su propia solución, no un permiso huérfano.
 */

export type OperatorCandidate = {
  userId: number;
  label: string;
  email: string | null;
  /** Quien opera (dueño, administrador o Equipo) puede todo sin permiso otorgado. */
  isAdmin: boolean;
  canProduce: boolean;
  canDeliver: boolean;
};

export async function listOperatorCandidates(workspaceId: string): Promise<OperatorCandidate[]> {
  const [unificadas, legado, permisos] = await Promise.all([
    prisma.workspaceMembership.findMany({
      where: { workspaceId },
      select: { userId: true, role: true, user: { select: { name: true, email: true } } },
    }),
    prisma.membership.findMany({
      where: { workspaceId },
      select: { userId: true, role: true, user: { select: { name: true, email: true } } },
    }),
    prisma.memberCardOperator.findMany({
      where: { workspaceId },
      select: { userId: true, canProduce: true, canDeliver: true },
    }),
  ]);

  const porUsuario = new Map<number, OperatorCandidate>();
  const permisoDe = new Map(permisos.map((p) => [p.userId, p]));

  // Se recorren las dos tablas de membresía: conviven durante la unificación, y mirar solo
  // una dejaría gente sin aparecer en la lista.
  for (const fila of [...unificadas, ...legado]) {
    const previo = porUsuario.get(fila.userId);
    const esAdmin = puede(fila.role, "operar");
    if (previo) {
      // Si figura en las dos, alcanza con que una de las dos filas opere.
      previo.isAdmin = previo.isAdmin || esAdmin;
      continue;
    }
    const permiso = permisoDe.get(fila.userId);
    porUsuario.set(fila.userId, {
      userId: fila.userId,
      label: fila.user.name?.trim() || fila.user.email || `Usuario ${fila.userId}`,
      email: fila.user.email,
      isAdmin: esAdmin,
      canProduce: permiso?.canProduce ?? false,
      canDeliver: permiso?.canDeliver ?? false,
    });
  }

  return [...porUsuario.values()].sort((a, b) => {
    if (a.isAdmin !== b.isAdmin) return a.isAdmin ? -1 : 1;
    return a.label.localeCompare(b.label, "es");
  });
}
