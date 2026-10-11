import "server-only";
import { Prisma, prisma } from "@repo/db";
import { puedeEnContexto } from "@/lib/access/policy";
import { CASH_MODULE_KEY } from "@/lib/cash/constants";
import { OPCIONES_TRANSACCION } from "@/lib/circuitos/recorridos";
import { decimalArsToMinor } from "@/lib/membership/money";
import { MENSAJES_GALERIA as M, puedeGestionarGalerias, puedeVerGalerias, type CtxGalerias } from "./acceso";
import { esModoVenta, type ModoVenta } from "./constantes";
import { registrarEvento } from "./eventos";
import { centavosAArs, type ConfigVenta, type ModoDescuento, type ModoPrecio } from "./precios";
import { MENSAJES_VENTA_FORM, aConfigVenta, centavosAFormulario, leerFormularioVenta, type FormularioVenta } from "./venta-form";

/**
 * Venta de fotos extra de una galería, lado del estudio (etapa 7, Entrega A2): leer y guardar la
 * configuración de la pestaña Venta, y el total vendido. Cada función exige el permiso adentro y acota TODA
 * consulta al `workspaceId` del contexto. Editar los precios NO toca las compras ya hechas: cada compra
 * guarda su propia instantánea de precios.
 */

const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;
const idValido = (v: unknown): v is string => typeof v === "string" && ID_VALIDO.test(v);
const no = (error: string) => ({ ok: false as const, error });

/** Quién puede ver cuánto se vendió y las comisiones: dueño o administrador, o "Ver" en Caja (el dinero va a Caja). */
export function puedeVerVentasGalerias(ctx: CtxGalerias): boolean {
  return ctx.userId !== null && puedeEnContexto(ctx, "verDinero", CASH_MODULE_KEY);
}

type FilaConfig = {
  saleMode: string;
  includedCount: number;
  pricingMode: string | null;
  unitPriceArs: { toString(): string } | null;
  packageSize: number | null;
  packagePriceArs: { toString(): string } | null;
  discountMode: string;
  discountPct: number | null;
  discountRules: unknown;
};

export const SELECT_CONFIG_VENTA = {
  saleMode: true, includedCount: true, pricingMode: true, unitPriceArs: true, packageSize: true, packagePriceArs: true,
  discountMode: true, discountPct: true, discountRules: true,
} as const;

/** Lo que guarda la fila de la galería, como configuración de venta en centavos. Una fila rara se lee como "sólo selección". */
export function configVentaDeFila(f: FilaConfig): ConfigVenta {
  const saleMode: ModoVenta = esModoVenta(f.saleMode) ? f.saleMode : "SELECCION";
  const pricingMode: ModoPrecio | null = f.pricingMode === "POR_FOTO" || f.pricingMode === "PAQUETE" ? f.pricingMode : null;
  const discountMode: ModoDescuento = f.discountMode === "UNICO" || f.discountMode === "PROGRESIVO" ? f.discountMode : "NINGUNO";
  return {
    saleMode,
    includedCount: f.includedCount,
    pricingMode,
    unitPriceCents: f.unitPriceArs === null ? null : decimalArsToMinor(f.unitPriceArs),
    packageSize: f.packageSize,
    packagePriceCents: f.packagePriceArs === null ? null : decimalArsToMinor(f.packagePriceArs),
    discountMode,
    discountPct: f.discountPct,
    discountRules: f.discountRules ?? null,
  };
}

export type RubroIngreso = { id: string; nombre: string };

/** Rubros de ingreso activos del workspace (más el actual, aunque esté inactivo). */
export async function rubrosDeIngresoGalerias(workspaceId: string, actuales: readonly (string | null)[] = []): Promise<RubroIngreso[]> {
  const ids = actuales.filter((x): x is string => !!x);
  const filas = await prisma.cashCategory.findMany({
    where: { workspaceId, kind: "INGRESO", OR: [{ isActive: true }, ...ids.map((id) => ({ id }))] },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
    take: 500,
  });
  return filas.map((f) => ({ id: f.id, nombre: f.name }));
}

export type VentaGaleria = {
  galeriaId: string;
  estado: string;
  formulario: FormularioVenta;
  config: ConfigVenta;
  rubros: RubroIngreso[];
  /** Nombre del rubro por omisión de Configuración → Galería, si hay. */
  rubroPorOmision: string | null;
  puedeGestionar: boolean;
};

/** La configuración de venta de la galería, lista para el formulario. null si no existe en el workspace o no hay "Ver". */
export async function cargarVentaGaleria(ctx: CtxGalerias, galeriaId: unknown): Promise<VentaGaleria | null> {
  if (!puedeVerGalerias(ctx) || !idValido(galeriaId)) return null;
  const { workspaceId } = ctx;
  const g = await prisma.fotofficeGaleria.findFirst({
    where: { id: galeriaId, workspaceId },
    select: { id: true, status: true, incomeCategoryId: true, ...SELECT_CONFIG_VENTA },
  });
  if (!g) return null;
  const config = configVentaDeFila(g);
  const ajustes = await prisma.fotofficeGaleriaAjustes.findFirst({ where: { workspaceId }, select: { defaultIncomeCategoryId: true } });
  const rubros = await rubrosDeIngresoGalerias(workspaceId, [g.incomeCategoryId, ajustes?.defaultIncomeCategoryId ?? null]);
  const reglas = Array.isArray(config.discountRules) ? (config.discountRules as { pct?: unknown; desde?: unknown }[]) : [];
  return {
    galeriaId: g.id,
    estado: g.status,
    config,
    rubros,
    rubroPorOmision: rubros.find((r) => r.id === ajustes?.defaultIncomeCategoryId)?.nombre ?? null,
    puedeGestionar: puedeGestionarGalerias(ctx),
    formulario: {
      saleMode: config.saleMode,
      includedCount: String(config.includedCount),
      pricingMode: config.pricingMode ?? "",
      unitPrice: centavosAFormulario(config.unitPriceCents),
      packageSize: config.packageSize === null ? "" : String(config.packageSize),
      packagePrice: centavosAFormulario(config.packagePriceCents),
      discountMode: config.discountMode,
      discountPct: config.discountPct === null ? "" : String(config.discountPct),
      reglas: reglas.map((r) => ({ pct: String(r.pct ?? ""), desde: String(r.desde ?? "") })),
      incomeCategoryId: g.incomeCategoryId ?? "",
    },
  };
}

export type ResultadoVenta = { ok: true } | { ok: false; error: string; errores?: string[] };

/**
 * Guarda la configuración de venta. Se valida en el servidor con las mismas reglas que los CHECK del SQL
 * (`validarConfigVenta`); lo que no corresponde al modo elegido se guarda vacío (con "Sólo selección" no queda
 * ningún precio ni descuento). No toca las compras que ya existen.
 */
export async function guardarVentaGaleria(ctx: CtxGalerias, galeriaId: unknown, datos: unknown): Promise<ResultadoVenta> {
  if (!puedeGestionarGalerias(ctx)) return no(M.sinPermiso);
  if (!idValido(galeriaId)) return no(M.datosInvalidos);
  const f = leerFormularioVenta(datos);
  if (!f) return no(MENSAJES_VENTA_FORM.datosInvalidos);
  const r = aConfigVenta(f);
  if (!r.ok) return { ok: false, error: r.errores[0] ?? MENSAJES_VENTA_FORM.datosInvalidos, errores: r.errores };
  const { workspaceId } = ctx;
  const c = r.config;
  if (r.rubroId !== null && !idValido(r.rubroId)) return no(MENSAJES_VENTA_FORM.rubroInvalido);
  try {
    return await prisma.$transaction(async (tx) => {
      if (r.rubroId !== null) {
        const rubro = await tx.cashCategory.findFirst({ where: { id: r.rubroId, workspaceId, kind: "INGRESO", isActive: true }, select: { id: true } });
        if (!rubro) return no(MENSAJES_VENTA_FORM.rubroInvalido);
      }
      const data: Prisma.FotofficeGaleriaUncheckedUpdateManyInput = {
        saleMode: c.saleMode,
        includedCount: c.includedCount,
        pricingMode: c.pricingMode,
        unitPriceArs: c.unitPriceCents === null ? null : centavosAArs(c.unitPriceCents),
        packageSize: c.packageSize,
        packagePriceArs: c.packagePriceCents === null ? null : centavosAArs(c.packagePriceCents),
        discountMode: c.discountMode,
        discountPct: c.discountPct,
        discountRules: c.discountMode === "PROGRESIVO" ? (c.discountRules as Prisma.InputJsonValue) : Prisma.DbNull,
        incomeCategoryId: r.rubroId,
      };
      // Una galería de entrega no se vende: el cliente recibe todo lo que tiene.
      const u = await tx.fotofficeGaleria.updateMany({ where: { id: galeriaId, workspaceId, kind: { not: "ENTREGA" } }, data });
      if (u.count !== 1) {
        const existe = await tx.fotofficeGaleria.findFirst({ where: { id: galeriaId, workspaceId }, select: { id: true } });
        return no(existe ? M.entregaSinVenta : M.noExiste);
      }
      await registrarEvento(tx, {
        workspaceId, galeriaId, tipo: "VENTA_CONFIGURADA", actorUserId: ctx.userId,
        data: { modo: c.saleMode, incluidas: c.includedCount, precio: c.pricingMode ?? "", descuento: c.discountMode },
      });
      return { ok: true as const };
    }, OPCIONES_TRANSACCION);
  } catch (e) {
    console.error("[galerias] guardar la venta falló", { codigo: typeof (e as { code?: unknown } | null)?.code === "string" ? (e as { code: string }).code : null });
    return no(M.guardar);
  }
}

// --- Total vendido -------------------------------------------------------------------------------------

/**
 * Lo vendido (compras PAGADAS) de cada galería, en centavos. Una sola consulta para toda la página. Sin
 * `puedeVerVentasGalerias` devuelve un mapa vacío: la cifra no sale de acá hacia quien no puede verla.
 */
export async function vendidoPorGaleria(ctx: CtxGalerias, galeriaIds: readonly string[]): Promise<Map<string, number>> {
  const ids = galeriaIds.filter(idValido);
  if (!puedeVerGalerias(ctx) || !puedeVerVentasGalerias(ctx) || ids.length === 0) return new Map();
  const filas = await prisma.fotofficeGaleriaCompra.groupBy({
    by: ["galeriaId"],
    where: { workspaceId: ctx.workspaceId, galeriaId: { in: ids }, status: "PAGADA" },
    _sum: { totalArs: true },
  });
  return new Map(filas.map((f) => [f.galeriaId, f._sum.totalArs === null || f._sum.totalArs === undefined ? 0 : decimalArsToMinor(f._sum.totalArs)]));
}
