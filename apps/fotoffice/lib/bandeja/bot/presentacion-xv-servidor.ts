import "server-only";
import { prisma } from "@repo/db";
import { asignarItems, totalesConAlternativas } from "@/lib/presupuestos/alternativas";
import { itemsDeLaPropuesta } from "@/lib/presupuestos/items-de-la-propuesta";
import { leerPropuestaModelo } from "@/lib/presupuestos/propuestas-modelo";
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
      const propuesta = await leerPropuestaModelo(workspaceId, c.id);
      if (!propuesta || propuesta.items.length === 0) continue;
      const instanciada = await itemsDeLaPropuesta(workspaceId, propuesta.items, ahora);
      if (!instanciada.ok) continue;
      const items = asignarItems(instanciada.items, propuesta.alternativas);
      const t = totalesConAlternativas(items, propuesta.alternativas, null);
      const desde = precioDesde(t.alternativas.length > 0 ? t.alternativas.map((a) => a.totales.total) : [t.totales.total]);
      if (desde !== null) return desde;
    }
    return null;
  } catch (e) {
    console.error("[fotoffice][whatsapp] no se pudo calcular el precio desde de XV", { codigo: (e as { code?: unknown } | null)?.code ?? "desconocido" });
    return null;
  }
}
