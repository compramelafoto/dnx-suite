import "server-only";
import { prisma } from "@repo/db";
import type { CuantoCobroPricingExtras } from "@repo/cuanto-cobro-core";
import { normalizarPerfil } from "@/lib/precios/perfil-datos";

/**
 * Impuestos, cobros y recargos del perfil de precios de la organización (etapa A), para congelar las
 * condiciones de cobro al enviar un presupuesto (etapa B). Lo lee el sistema (sin permiso de costos):
 * sólo usa IVA, seña, comisión y política de cancelación, que el cliente igual ve. null si no hay.
 */
export async function extrasDelWorkspace(workspaceId: string): Promise<CuantoCobroPricingExtras | null> {
  const fila = await prisma.fotofficePerfilPrecios.findUnique({ where: { workspaceId }, select: { profileData: true } });
  return fila ? (normalizarPerfil(fila.profileData)?.pricingExtras ?? null) : null;
}
