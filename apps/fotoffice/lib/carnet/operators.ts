import { prisma } from "@repo/db";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";
import type { FulfillmentCapability } from "./fulfillment";

/**
 * Qué puede hacer una persona con los carnets de un workspace.
 *
 * El dueño y los administradores pueden todo sin figurar en ninguna tabla: son quienes
 * responden por la institución. Los permisos otorgados existen para el caso que motivó
 * esto — el impresor entra al sistema, marca los carnets como impresos, y nada más.
 */
export async function resolveCardCapabilities(
  userId: number,
  workspaceId: string,
): Promise<FulfillmentCapability[]> {
  const [membership, legacy, grant] = await Promise.all([
    prisma.workspaceMembership.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
      select: { role: true },
    }),
    prisma.membership.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
      select: { role: true },
    }),
    prisma.memberCardOperator.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { canProduce: true, canDeliver: true },
    }),
  ]);

  const administra =
    canManageWorkspaceSettings(membership?.role) || canManageWorkspaceSettings(legacy?.role);
  if (administra) return ["PRODUCIR", "ENTREGAR", "ADMINISTRAR"];

  const capacidades: FulfillmentCapability[] = [];
  if (grant?.canProduce) capacidades.push("PRODUCIR");
  if (grant?.canDeliver) capacidades.push("ENTREGAR");
  return capacidades;
}

/**
 * Ver el estado de los carnets.
 *
 * Alcanza con tener alguna capacidad otorgada: al impresor le sirve de poco poder marcar
 * como impreso si no puede ver qué tiene para imprimir. Quien no tiene ninguna, no ve nada.
 */
export function canViewCards(capabilities: FulfillmentCapability[]): boolean {
  return capabilities.length > 0;
}
