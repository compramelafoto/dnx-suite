import "server-only";
import { prisma } from "@repo/db";
import { esSlugDnx } from "@/lib/slug-dnx";
import { SEGUIMIENTO_POR_OMISION_DIAS, VALIDEZ_POR_OMISION_DIAS } from "./constantes";

/**
 * Ajustes de presupuestos de DNX Estudio (spec §2 A y B): validez de 15 días y seguimiento a 3
 * días. El seguimiento queda APAGADO: la tarea que lo manda llega en la Entrega B.
 *
 * Sólo para DNX y sólo si no hay fila: nunca pisa lo que alguien ya configuró. Idempotente: el
 * único de `workspaceId` frena una corrida simultánea. Devuelve si creó la fila.
 *
 * La numeración de Presupuestos de DNX (seguir la de Alboom en 2025262) se configura a mano en
 * Configuración → Numeración (ver el documento de la migración).
 */
export async function asegurarAjustesDnx(workspaceId: string, slug: string | null | undefined): Promise<boolean> {
  if (!esSlugDnx(slug)) return false;
  const r = await prisma.fotofficePresupuestoAjustes.createMany({
    data: [{
      workspaceId,
      validityDays: VALIDEZ_POR_OMISION_DIAS,
      followUpDays: SEGUIMIENTO_POR_OMISION_DIAS,
      followUpEnabled: false,
    }],
    skipDuplicates: true,
  });
  return r.count > 0;
}
