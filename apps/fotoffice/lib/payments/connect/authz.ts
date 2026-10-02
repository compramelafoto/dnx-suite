import { prisma } from "@repo/db";
import { puede } from "@/lib/access/policy";

/**
 * Permisos sobre el cobro del workspace, en dos niveles (0.1):
 * - `canManageWorkspaceCollection` = configurar (conectar Mercado Pago, valores, calendario,
 *   split): dueño o administrador. Conectar una cuenta decide **a dónde va la plata**.
 * - `canOperateWorkspaceCollection` = operar (generar cuotas, registrar pagos, solicitudes,
 *   emitir carnets): también Equipo.
 *
 * A diferencia de Clickatón, que autoriza con una capacidad `DNX_FINANCE_OWNER` sobre un
 * actor de finanzas, acá la fuente de verdad es la membresía del workspace: son modelos de
 * permisos distintos y mezclarlos daría acceso cruzado entre productos.
 */
async function resolveCollectionRole(userId: number, workspaceId: string): Promise<string[]> {
  const [membership, legacy] = await Promise.all([
    prisma.workspaceMembership.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
      select: { role: true },
    }),
    prisma.membership.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
      select: { role: true },
    }),
  ]);
  return [membership?.role, legacy?.role].filter((r): r is NonNullable<typeof r> => Boolean(r));
}

/** Configurar el cobro (conexión de MP, valores, calendario, split): Dueño/Admin. */
export async function canManageWorkspaceCollection(
  userId: number,
  workspaceId: string,
): Promise<boolean> {
  const roles = await resolveCollectionRole(userId, workspaceId);
  return roles.some((r) => puede(r, "configurar"));
}

/** Operar cobros (generar cuotas, registrar pagos, emitir carnets, solicitudes): incluye Equipo. */
export async function canOperateWorkspaceCollection(
  userId: number,
  workspaceId: string,
): Promise<boolean> {
  const roles = await resolveCollectionRole(userId, workspaceId);
  return roles.some((r) => puede(r, "operar"));
}
