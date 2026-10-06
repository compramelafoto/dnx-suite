import { prisma } from "@repo/db";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";

/**
 * ¿Puede esta persona conectar o desconectar el cobro de este workspace?
 *
 * Conectar una cuenta de MercadoPago decide **a dónde va la plata** de la institución, así
 * que se exige el mismo nivel que la configuración del workspace: dueño o administrador.
 * STAFF puede ver el estado, no cambiarlo.
 *
 * A diferencia de Clickatón, que autoriza con una capacidad `DNX_FINANCE_OWNER` sobre un
 * actor de finanzas, acá la fuente de verdad es la membresía del workspace: son modelos de
 * permisos distintos y mezclarlos daría acceso cruzado entre productos.
 */
export async function canManageWorkspaceCollection(
  userId: number,
  workspaceId: string,
): Promise<boolean> {
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

  return (
    canManageWorkspaceSettings(membership?.role) || canManageWorkspaceSettings(legacy?.role)
  );
}
