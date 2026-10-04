import { prisma } from "@repo/db";
import { hasModuleLevel } from "@/lib/permissions/module-access";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import type { FulfillmentCapability } from "./fulfillment";

/**
 * Qué puede hacer una persona con los carnets de un workspace.
 *
 * Quien gestiona Socios (`members` MANAGE: dueño, admin o un rol que lo dé) puede todo sin
 * figurar en ninguna tabla: responde por el padrón. Los permisos otorgados existen para el caso
 * que motivó esto — el impresor entra al sistema, marca los carnets como impresos, y nada más.
 *
 * Ya no se lee la tabla legacy `Membership`: el nivel sale de `WorkspaceMembership` y de los
 * roles, como en el resto de los módulos (la única cuenta sólo-legacy es un seed de FotoRank).
 */
export async function resolveCardCapabilities(
  userId: number,
  workspaceId: string,
): Promise<FulfillmentCapability[]> {
  const [gestiona, grant] = await Promise.all([
    hasModuleLevel(userId, workspaceId, MEMBERS_MODULE_KEY, "MANAGE"),
    prisma.memberCardOperator.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { canProduce: true, canDeliver: true },
    }),
  ]);

  if (gestiona) return ["PRODUCIR", "ENTREGAR", "ADMINISTRAR"];

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
