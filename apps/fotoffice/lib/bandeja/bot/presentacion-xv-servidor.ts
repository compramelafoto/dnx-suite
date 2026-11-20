import "server-only";
import { prisma } from "@repo/db";
import { paquetesDeLaCategoria } from "./eventos-con-portfolio-servidor";
import { esCategoriaXv, precioDesde } from "./presentacion-xv";

/**
 * El "desde" de XV para la presentación del bot: la propuesta modelo de la categoría de XV, a los
 * precios de hoy (catálogo y perfil de ¿Cuánto cobro?, como cuando se arma la cotización), y el
 * menor total entre sus opciones, sin opcionales, traslado ni segundo fotógrafo. Si no hay
 * categoría de XV, propuesta o precio que se pueda calcular: null (el bot no dice precio).
 * Nunca lanza.
 */
export async function precioDesdeXv(workspaceId: string, ahora: Date = new Date()): Promise<number | null> {
  try {
    const categorias = await prisma.fotofficeConsultaCategoria.findMany({
      where: { workspaceId, archivedAt: null },
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
      take: 500,
    });
    for (const c of categorias.filter((c) => esCategoriaXv(c.name))) {
      const desde = precioDesde((await paquetesDeLaCategoria(workspaceId, c.id, c.name, ahora)).map((p) => p.total));
      if (desde !== null) return desde;
    }
    return null;
  } catch (e) {
    console.error("[fotoffice][whatsapp] no se pudo calcular el precio desde de XV", { codigo: (e as { code?: unknown } | null)?.code ?? "desconocido" });
    return null;
  }
}
