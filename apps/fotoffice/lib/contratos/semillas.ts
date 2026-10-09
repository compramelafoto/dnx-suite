import "server-only";
import { prisma } from "@repo/db";
import { esSlugDnx } from "@/lib/slug-dnx";
import { CUERPO_PLANTILLA_MODELO, NOMBRE_PLANTILLA_MODELO } from "./modelo";

/**
 * Siembra la plantilla "Contrato de eventos (modelo)", sólo para DNX y sólo si la organización todavía
 * no tiene ninguna plantilla de contrato (así, si la borra o la renombra, no vuelve a aparecer).
 * Idempotente: el único (workspaceId, name) frena una corrida simultánea (`skipDuplicates`). Devuelve
 * cuántas creó. Se llama al abrir las pantallas de Configuración → Contratos.
 */
export async function asegurarPlantillaModeloDnx(workspaceId: string, slug: string | null | undefined): Promise<number> {
  if (!esSlugDnx(slug)) return 0;
  if ((await prisma.fotofficeContratoPlantilla.count({ where: { workspaceId } })) > 0) return 0;
  const r = await prisma.fotofficeContratoPlantilla.createMany({
    data: [{ workspaceId, name: NOMBRE_PLANTILLA_MODELO, body: CUERPO_PLANTILLA_MODELO, isActive: true, order: 0 }],
    skipDuplicates: true,
  });
  return r.count;
}
