import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { decimalArsToMinor } from "@/lib/membership/money";
import { resolveWorkspaceRole } from "@/lib/workspace-role";
import { SKU_CAJA_FOTOLIBRO, SKU_FOTOLIBRO_FLEXIBLE, SKU_FOTOLIBRO_RIGIDA } from "@/lib/fotolibro/venta";
import {
  calcularComisiones,
  inicioDelMesEnArgentina,
  resumir,
  type Comision,
  type MiComision,
  type PedidoComision,
  type ReglaComision,
  type VentaComision,
} from "./calculo";

/**
 * Comisión de venta del equipo: quién la cobra (`FotofficeComisionVendedor`) y lo ganado, que
 * se calcula de las ventas y los pedidos cada vez que se mira (así está siempre al día: un saldo
 * cobrado mañana suma mañana). Los productos con comisión los elige el dueño
 * (`FotofficeComisionProducto`); sin elegir ninguno, rigen los de fotolibro, por código.
 */

export const SKUS_CON_COMISION = [SKU_FOTOLIBRO_FLEXIBLE, SKU_FOTOLIBRO_RIGIDA, SKU_CAJA_FOTOLIBRO];

const ROLES_DUENO = new Set(["WORKSPACE_OWNER", "WORKSPACE_ADMIN"]);

/** Quien define las comisiones y ve las de todo el equipo. */
export async function esDuenoOAdmin(userId: number, workspaceId: string): Promise<boolean> {
  return ROLES_DUENO.has((await resolveWorkspaceRole(userId, workspaceId)) ?? "");
}

export type ReglaVendedor = ReglaComision & { activa: boolean };

/** Los productos del workspace que dan comisión: los elegidos o, sin elegir, los de fotolibro. */
export async function productosConComision(workspaceId: string): Promise<string[]> {
  const elegidos = await prisma.fotofficeComisionProducto.findMany({ where: { workspaceId }, select: { productId: true } });
  if (elegidos.length > 0) return elegidos.map((e) => e.productId);
  const filas = await prisma.product.findMany({
    where: { workspaceId, OR: SKUS_CON_COMISION.map((sku) => ({ sku: { equals: sku, mode: "insensitive" as const } })) },
    select: { id: true },
  });
  return filas.map((f) => f.id);
}

export async function leerReglas(workspaceId: string): Promise<ReglaVendedor[]> {
  const filas = await prisma.fotofficeComisionVendedor.findMany({ where: { workspaceId } });
  return filas.map((f) => ({ userId: f.userId, porcentaje: Number(f.porcentaje.toString()), desde: f.desde, activa: f.activa }));
}

/** La regla activa de una persona, o null si no cobra comisión. */
export async function reglaDe(workspaceId: string, userId: number): Promise<ReglaComision | null> {
  const f = await prisma.fotofficeComisionVendedor.findUnique({ where: { workspaceId_userId: { workspaceId, userId } } });
  return f && f.activa ? { userId: f.userId, porcentaje: Number(f.porcentaje.toString()), desde: f.desde } : null;
}

type ItemPedido = { productId?: unknown; nombre?: unknown; cantidad?: unknown; precioUnitario?: unknown };

function renglonesDelPedido(items: Prisma.JsonValue, conComision: ReadonlySet<string>) {
  if (!Array.isArray(items)) return [];
  return (items as ItemPedido[]).flatMap((i) => {
    if (typeof i?.productId !== "string" || !conComision.has(i.productId)) return [];
    const cantidad = typeof i.cantidad === "number" ? i.cantidad : 0;
    const precio = typeof i.precioUnitario === "number" ? i.precioUnitario : 0;
    return [{ nombre: typeof i.nombre === "string" ? i.nombre : "Fotolibro", baseMinor: Math.round(cantidad * precio * 100) }];
  });
}

/** Las comisiones de las reglas activas (de una persona, si se pide), con todo lo vendido desde que rige. */
export async function comisionesDelWorkspace(workspaceId: string, soloUserId: number | null = null): Promise<{ reglas: ReglaComision[]; comisiones: Comision[] }> {
  const reglas = (await leerReglas(workspaceId)).filter((r) => r.activa && (soloUserId === null || r.userId === soloUserId));
  if (reglas.length === 0) return { reglas, comisiones: [] };
  const productos = new Set(await productosConComision(workspaceId));
  if (productos.size === 0) return { reglas, comisiones: [] };
  const usuarios = reglas.map((r) => r.userId);
  const desde = new Date(Math.min(...reglas.map((r) => r.desde.getTime())));

  const [pedidos, ventas] = await Promise.all([
    prisma.fotofficePedido.findMany({
      where: { workspaceId, createdByUserId: { in: usuarios }, createdAt: { gte: desde } },
      select: {
        id: true,
        number: true,
        createdByUserId: true,
        createdAt: true,
        status: true,
        items: true,
        totalArs: true,
        cobros: { where: { voidedAt: null }, select: { amountArs: true, paidAt: true } },
      },
    }),
    prisma.sale.findMany({
      where: {
        workspaceId,
        createdByUserId: { in: usuarios },
        occurredAt: { gte: desde },
        status: "COMPLETADA",
        voidedAt: null,
        items: { some: { productId: { in: [...productos] } } },
      },
      select: {
        id: true,
        saleNumber: true,
        createdByUserId: true,
        occurredAt: true,
        items: { where: { productId: { in: [...productos] } }, select: { description: true, lineTotalArs: true } },
      },
    }),
  ]);

  const dePedidos: PedidoComision[] = pedidos.map((p) => ({
    id: p.id,
    numero: p.number,
    vendedorId: p.createdByUserId,
    creado: p.createdAt,
    estado: p.status,
    totalMinor: decimalArsToMinor(p.totalArs),
    renglones: renglonesDelPedido(p.items, productos),
    cobros: p.cobros.map((c) => ({ montoMinor: decimalArsToMinor(c.amountArs), fecha: c.paidAt })),
  }));
  const deVentas: VentaComision[] = ventas.map((v) => ({
    id: v.id,
    numero: String(v.saleNumber),
    vendedorId: v.createdByUserId,
    fecha: v.occurredAt,
    renglones: v.items.map((i) => ({ nombre: i.description, baseMinor: decimalArsToMinor(i.lineTotalArs) })),
  }));
  return { reglas, comisiones: calcularComisiones(reglas, dePedidos, deVentas) };
}


/** Lo de una persona para el Cobrador: su porcentaje y lo acumulado. null si no cobra comisión. */
export async function miComision(workspaceId: string, userId: number): Promise<MiComision | null> {
  const { reglas, comisiones } = await comisionesDelWorkspace(workspaceId, userId);
  const regla = reglas[0];
  if (!regla) return null;
  return { porcentaje: regla.porcentaje, resumen: resumir(comisiones, inicioDelMesEnArgentina(new Date())) };
}

/** Las personas del equipo, para elegir quién cobra comisión. */
export async function equipoDelWorkspace(workspaceId: string): Promise<{ userId: number; nombre: string; email: string; rol: string }[]> {
  const filas = await prisma.workspaceMembership.findMany({
    where: { workspaceId },
    select: { role: true, user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  return filas.map((f) => ({ userId: f.user.id, nombre: f.user.name?.trim() || f.user.email, email: f.user.email, rol: f.role }));
}

export async function guardarReglas(
  workspaceId: string,
  reglas: { userId: number; porcentaje: number; activa: boolean }[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const equipo = new Set((await equipoDelWorkspace(workspaceId)).map((m) => m.userId));
  for (const r of reglas) {
    if (!equipo.has(r.userId)) return { ok: false, error: "Esa persona no es del equipo." };
    if (!Number.isFinite(r.porcentaje) || r.porcentaje < 0 || r.porcentaje > 50) return { ok: false, error: "El porcentaje va de 0 a 50." };
  }
  const antes = new Map((await leerReglas(workspaceId)).map((r) => [r.userId, r]));
  await prisma.$transaction(
    reglas.map((r) =>
      prisma.fotofficeComisionVendedor.upsert({
        where: { workspaceId_userId: { workspaceId, userId: r.userId } },
        create: { workspaceId, userId: r.userId, porcentaje: r.porcentaje.toFixed(2), activa: r.activa },
        // Al volver a encender, cuenta desde ese momento: lo vendido mientras estaba apagada no suma.
        update: { porcentaje: r.porcentaje.toFixed(2), activa: r.activa, ...(r.activa && antes.get(r.userId)?.activa === false ? { desde: new Date() } : {}) },
      }),
    ),
  );
  return { ok: true };
}

/** El catálogo para elegir qué da comisión, con su margen (sin insumos ni inactivos). */
export async function catalogoParaComision(workspaceId: string): Promise<
  { id: string; nombre: string; categoria: string; precioMinor: number; margenPct: number | null }[]
> {
  const filas = await prisma.product.findMany({
    where: { workspaceId, isActive: true, kind: { not: "INSUMO" } },
    select: { id: true, name: true, priceArs: true, costArs: true, category: { select: { name: true } } },
    orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
  });
  return filas.map((p) => {
    const precio = decimalArsToMinor(p.priceArs);
    const costo = p.costArs ? decimalArsToMinor(p.costArs) : null;
    return {
      id: p.id,
      nombre: p.name,
      categoria: p.category?.name ?? "Sin categoría",
      precioMinor: precio,
      margenPct: costo !== null && costo > 0 && precio > 0 ? Math.round((100 * (precio - costo)) / precio) : null,
    };
  });
}

/** Reemplaza la lista de productos con comisión por la elegida. */
export async function guardarProductosConComision(workspaceId: string, productIds: string[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const unicos = [...new Set(productIds)];
  const validos = await prisma.product.count({ where: { workspaceId, id: { in: unicos } } });
  if (validos !== unicos.length) return { ok: false, error: "Hay un producto que no es de este negocio." };
  await prisma.$transaction([
    prisma.fotofficeComisionProducto.deleteMany({ where: { workspaceId } }),
    prisma.fotofficeComisionProducto.createMany({ data: unicos.map((productId) => ({ workspaceId, productId })) }),
  ]);
  return { ok: true };
}
