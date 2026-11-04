import "server-only";
import { prisma } from "@repo/db";
import { leerCatalogoFotolibro } from "./catalogo-precios";
import { cotizarParaBot, ofertaParaBot, type PedidoFotolibro, type RespuestaFotolibro } from "./bot";
import { SKU_FOTOLIBRO_FLEXIBLE, SKU_FOTOLIBRO_RIGIDA } from "./venta";

/**
 * Cotiza un fotolibro para el bot con la misma lista y margen que el Cobrador. El laboratorio es
 * el del producto del catálogo («Fotolibro tapa rígida» / «tapa flexible»), como en el mostrador.
 * Con costos: el pedido del bot los lleva al trabajo; al cliente nunca le llegan.
 */
export async function cotizarFotolibroParaBot(workspaceId: string, pedido: PedidoFotolibro): Promise<RespuestaFotolibro> {
  const [catalogo, producto] = await Promise.all([
    leerCatalogoFotolibro(workspaceId, { conCostos: true }),
    prisma.product.findFirst({
      where: { workspaceId, isActive: true, sku: pedido.tapa === "FLEXIBLE" ? SKU_FOTOLIBRO_FLEXIBLE : SKU_FOTOLIBRO_RIGIDA },
      select: { preferredProveedorId: true },
    }),
  ]);
  if (!catalogo) return { tipo: "ERROR", mensaje: "El estudio no tiene cargada la lista de precios de fotolibros." };
  const oferta = ofertaParaBot(catalogo, producto?.preferredProveedorId ?? null);
  if (!oferta) return { tipo: "ERROR", mensaje: "El estudio no tiene cargada la lista de precios de fotolibros." };
  return cotizarParaBot(catalogo, oferta, pedido);
}
