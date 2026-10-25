import "server-only";
import { prisma } from "@repo/db";
import { NO_ES_INSUMO } from "@/lib/sales/vendible";
import { decimalArsToMinor } from "@/lib/membership/money";
import { leerPerfilPreciosDelSistema } from "@/lib/precios/perfil";
import { leerCatalogoFotolibro } from "@/lib/fotolibro/catalogo-precios";
import type { ItemPresupuesto } from "./constantes";
import { nuevaClave } from "./editor";
import { instanciarPropuesta, type ProductoDeCatalogo, type ResultadoInstanciar } from "./instanciar-propuesta";

/**
 * Los ítems de una propuesta modelo "a hoy": los de lista con nombre, descripción y precio del
 * catálogo de ahora; los calculados, vueltos a correr con el perfil del workspace (leído como el
 * sistema: el perfil nunca sale de acá); los fotolibros, con la lista del proveedor de hoy.
 * Devuelve el motivo si no se puede.
 *
 * Lo comparten el envío automático de la consulta web y el "Nuevo presupuesto" precargado.
 */
export async function itemsDeLaPropuesta(
  workspaceId: string,
  items: ItemPresupuesto[],
  ahora: Date,
): Promise<ResultadoInstanciar> {
  const ids = [...new Set(items.map((i) => i.productId).filter((x): x is string => x !== null))];
  const productos = await prisma.product.findMany({
    where: { workspaceId, id: { in: ids }, isActive: true, ...NO_ES_INSUMO },
    select: { id: true, name: true, description: true, priceArs: true },
  });
  const deId = new Map<string, ProductoDeCatalogo>(
    productos.map((p) => [p.id, { nombre: p.name, descripcion: p.description, precio: decimalArsToMinor(p.priceArs) / 100 }]),
  );
  const perfil = items.some((i) => i.modoPrecio === "CALCULO") ? await leerPerfilPreciosDelSistema(workspaceId) : null;
  // Los fotolibros se cotizan con las listas de hoy (sin costos: sólo el precio de venta).
  const fotolibro = items.some((i) => i.fotolibro) ? await leerCatalogoFotolibro(workspaceId, { conCostos: false }) : null;
  return instanciarPropuesta(items, { productos: deId, perfil, fotolibro, nuevaClave, ahora });
}
