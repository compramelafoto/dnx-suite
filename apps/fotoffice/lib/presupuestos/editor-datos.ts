import "server-only";
import { prisma } from "@repo/db";
import type { CuantoCobroProfileInput } from "@repo/cuanto-cobro-core";
import { leerPerfilPrecios } from "@/lib/precios/perfil";
import { resumenCombo } from "@/lib/catalogo/reglas";
import { decimalArsToMinor } from "@/lib/membership/money";
import { veCostos, type CtxPresupuestos } from "./acceso";
import type { CostoDeCatalogo } from "./costos";
import type { ProductoParaEditor } from "./editor";
import { costosDelCatalogo } from "./versiones";

/**
 * Lecturas del editor (sólo servidor). El catálogo sale sin costos; los costos del catálogo y el
 * perfil de ¿Cuánto Cobro? sólo con `veCostos` (R4): sin permiso estas funciones devuelven vacío
 * sin leer nada.
 */

const TOPE_CATALOGO = 500;
const aPesos = (minor: number): number => minor / 100;

/** Productos activos del workspace para el buscador: precio, si está en lista y, si es combo, el ahorro. */
export async function catalogoParaEditor(workspaceId: string): Promise<ProductoParaEditor[]> {
  const productos = await prisma.product.findMany({
    where: { workspaceId, isActive: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: { id: true, name: true, description: true, priceArs: true },
    take: TOPE_CATALOGO,
  });
  if (productos.length === 0) return [];
  const ids = productos.map((p) => p.id);
  const perfiles = await prisma.fotofficeProductoCatalogo.findMany({
    where: { workspaceId, productId: { in: ids } },
    select: { productId: true, inPriceList: true, isCombo: true },
  });
  const perfilDe = new Map(perfiles.map((p) => [p.productId, p]));
  const combos = perfiles.filter((p) => p.isCombo).map((p) => p.productId);
  const componentes = combos.length
    ? await prisma.fotofficeComboItem.findMany({
        where: { workspaceId, comboProductId: { in: combos } },
        select: { comboProductId: true, componentProductId: true, quantity: true },
      })
    : [];
  const faltan = [...new Set(componentes.map((c) => c.componentProductId))].filter((id) => !ids.includes(id));
  const extra = faltan.length
    ? await prisma.product.findMany({ where: { workspaceId, id: { in: faltan } }, select: { id: true, priceArs: true } })
    : [];
  const precioMinor = new Map([...productos, ...extra].map((p) => [p.id, decimalArsToMinor(p.priceArs)]));

  return productos.map((p) => {
    const perfil = perfilDe.get(p.id);
    const precio = precioMinor.get(p.id) ?? 0;
    let sumaComponentes: number | null = null;
    let ahorro: number | null = null;
    if (perfil?.isCombo) {
      const delCombo = componentes
        .filter((c) => c.comboProductId === p.id && precioMinor.has(c.componentProductId))
        .map((c) => ({ priceMinor: precioMinor.get(c.componentProductId)!, quantity: c.quantity }));
      const r = resumenCombo(precio, delCombo);
      sumaComponentes = aPesos(r.sumaComponentesMinor);
      ahorro = aPesos(r.ahorroMinor);
    }
    return {
      id: p.id,
      nombre: p.name,
      descripcion: p.description,
      precio: aPesos(precio),
      enLista: perfil?.inPriceList === true,
      esCombo: perfil?.isCombo === true,
      sumaComponentes,
      ahorro,
    };
  });
}

/** Costos de los productos del editor. Sin `veCostos`, vacío y sin leer. */
export async function costosCatalogoParaEditor(ctx: CtxPresupuestos, productIds: string[]): Promise<Record<string, CostoDeCatalogo>> {
  if (!veCostos(ctx) || productIds.length === 0) return {};
  return Object.fromEntries(await costosDelCatalogo(ctx.workspaceId, productIds));
}

/**
 * Perfil de ¿Cuánto Cobro? del workspace (Configuración → Precios) para el panel del editor.
 * Sin `veCostos`, null y sin leer (lo garantiza `leerPerfilPrecios`); sin perfil cargado, null.
 */
export async function perfilDelWorkspace(ctx: CtxPresupuestos): Promise<CuantoCobroProfileInput | null> {
  return (await leerPerfilPrecios(ctx))?.perfil ?? null;
}
