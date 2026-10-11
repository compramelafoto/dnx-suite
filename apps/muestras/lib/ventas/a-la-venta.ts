import "server-only";
import { prisma } from "@repo/db";

/**
 * ¿La obra tiene algo a la venta? Sin precio: es lo que decide si aparece "Adquirir obra" (también
 * en páginas en caché) y si la página de compra existe. Vale para obras de expositores **y de
 * concurso** (la etapa 7 nunca mostraba el botón en las de concurso).
 *
 * - `ofertaAprobada`: algún formato aprobado por la organización (etapa 8).
 * - `marcada`: la marca de las etapas 6 y 7 ("La quiero vender" del expositor, o la venta aceptada
 *   por el autor del concurso). Con la venta apagada sigue mostrando "La venta de esta obra todavía
 *   no está disponible", como hasta ahora.
 */
export async function obraALaVenta(activityId: string, activityWorkId: string): Promise<{ ofertaAprobada: boolean; marcada: boolean }> {
  const [ofertas, expositor, concurso] = await Promise.all([
    prisma.culturalWorkOffer.count({ where: { activityId, activityWorkId, status: "APPROVED", approvedPriceArs: { not: null } } }),
    prisma.culturalExhibitorWork.findFirst({ where: { activityId, activityWorkId, forSale: true }, select: { id: true } }),
    prisma.culturalContestWork.findFirst({ where: { activityId, activityWorkId, forSale: true, saleConsent: "ACCEPTED" }, select: { id: true } }),
  ]);
  return { ofertaAprobada: ofertas > 0, marcada: expositor != null || concurso != null };
}
