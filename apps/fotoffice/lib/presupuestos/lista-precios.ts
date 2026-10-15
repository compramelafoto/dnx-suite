import "server-only";
import { prisma } from "@repo/db";
import { decimalArsToMinor } from "@/lib/membership/money";

/**
 * Variable `[lista_precios]` de las plantillas de CONSULTA y PRESUPUESTO (etapa 2, Entrega B,
 * spec §2 B.15): los productos activos del catálogo marcados "en lista de precios", agrupados por
 * su categoría de Ventas, con nombre y precio en pesos (es-AR).
 *
 * **[decisión]** Los productos no tienen categoría de consulta: la lista es la de todos los
 * productos "en lista de precios" de la organización. Hasta `MAX_LINEAS_LISTA` productos; si hay
 * más, una última línea lo dice. Sin productos, null (así `[si:lista_precios]` se puede usar).
 * No incluye costos.
 */

export const MAX_LINEAS_LISTA = 50;
const SIN_CATEGORIA = "Otros";

export type ProductoDeLista = { nombre: string; precio: number; categoria: string | null; ordenCategoria: number };

const formatoPesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** "$ 600.000" o "$ 150.000,5" (es-AR). */
export function precioDeLista(pesos: number): string {
  return formatoPesos.format(pesos);
}

/** PURO. El texto de la lista (o null si no hay productos). Respeta el orden en que llegan. */
export function textoListaPrecios(productos: readonly ProductoDeLista[]): string | null {
  if (productos.length === 0) return null;
  const visibles = productos.slice(0, MAX_LINEAS_LISTA);
  const grupos = new Map<string, { orden: number; lineas: string[] }>();
  for (const p of visibles) {
    const clave = p.categoria?.trim() || SIN_CATEGORIA;
    const orden = p.categoria?.trim() ? p.ordenCategoria : Number.MAX_SAFE_INTEGER;
    const g = grupos.get(clave) ?? { orden, lineas: [] };
    g.lineas.push(`- ${p.nombre.trim()}: ${precioDeLista(p.precio)}`);
    grupos.set(clave, g);
  }
  const ordenados = [...grupos.entries()].sort((a, b) => a[1].orden - b[1].orden || a[0].localeCompare(b[0], "es"));
  // Con una sola categoría, sin títulos.
  const bloques = ordenados.length === 1 ? [ordenados[0]![1].lineas.join("\n")] : ordenados.map(([nombre, g]) => `${nombre}\n${g.lineas.join("\n")}`);
  const resto = productos.length - visibles.length;
  if (resto > 0) bloques.push(resto === 1 ? "Y 1 producto más." : `Y ${resto} productos más.`);
  return bloques.join("\n\n");
}

/** Lee los productos "en lista de precios" del workspace y arma el texto. */
export async function listaDePrecios(workspaceId: string): Promise<string | null> {
  const perfiles = await prisma.fotofficeProductoCatalogo.findMany({
    where: { workspaceId, inPriceList: true },
    select: { productId: true },
    take: 1000,
  });
  if (perfiles.length === 0) return null;
  const productos = await prisma.product.findMany({
    where: { workspaceId, id: { in: perfiles.map((p) => p.productId) }, isActive: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: { name: true, priceArs: true, categoryId: true },
    take: 1000,
  });
  if (productos.length === 0) return null;
  const idsCategorias = [...new Set(productos.map((p) => p.categoryId).filter((x): x is string => !!x))];
  const categorias = idsCategorias.length
    ? await prisma.productCategory.findMany({ where: { workspaceId, id: { in: idsCategorias } }, select: { id: true, name: true, order: true } })
    : [];
  const deId = new Map(categorias.map((c) => [c.id, c]));
  const lista: ProductoDeLista[] = productos.map((p) => {
    const c = p.categoryId ? deId.get(p.categoryId) : undefined;
    return { nombre: p.name, precio: decimalArsToMinor(p.priceArs) / 100, categoria: c?.name ?? null, ordenCategoria: c?.order ?? 0 };
  });
  // Agrupados por categoría (en su orden), y dentro de cada una por nombre.
  lista.sort((a, b) => {
    const oa = a.categoria ? a.ordenCategoria : Number.MAX_SAFE_INTEGER;
    const ob = b.categoria ? b.ordenCategoria : Number.MAX_SAFE_INTEGER;
    return oa - ob || (a.categoria ?? "").localeCompare(b.categoria ?? "", "es") || a.nombre.localeCompare(b.nombre, "es");
  });
  return textoListaPrecios(lista);
}
