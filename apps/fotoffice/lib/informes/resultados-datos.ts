import "server-only";
import { prisma } from "@repo/db";
import { hoyEnBuenosAires } from "@/lib/listado/periodos";
import { decimalArsToMinor } from "@/lib/membership/money";
import { fechaDeBase, fechaParaBase } from "@/lib/pedidos/plan";
import { puedeVerInformes, type CtxInformes } from "./acceso";
import { AVISO_DEMASIADOS_DATOS, MAX_FILAS_CUOTAS_Y_CUENTAS, MAX_MOVIMIENTOS_INFORME } from "./constantes";
import { sumarDias } from "./fechas";
import { inicioDeMes, inicioDelMesSiguiente, periodoInforme, sumarMeses, type PeriodoInforme } from "./periodos";
import {
  armarResultados,
  asientosDeCaja,
  asientosDevengados,
  type Asiento,
  type CuentaPagarFila,
  type MatrizResultados,
  type MovimientoCajaFila,
  type MovimientoOriginal,
  type PedidoFila,
  type RubroInfo,
} from "./resultados";

/**
 * Lectura de Resultados (etapa 6). Cada consulta filtra por `workspaceId`. Los topes (50 000
 * movimientos, 20 000 pedidos o cuentas) se miden leyendo uno más que el tope: si se pasa, no se
 * devuelven datos parciales sino el aviso.
 */

export type BaseResultados = "caja" | "devengado";
export const BASE_RESULTADOS_POR_OMISION: BaseResultados = "caja";
export const ETIQUETAS_BASE: Record<BaseResultados, string> = {
  caja: "Lo cobrado y pagado",
  devengado: "Lo vendido y comprometido",
};

export function baseElegida(v: unknown): BaseResultados {
  return v === "devengado" ? "devengado" : BASE_RESULTADOS_POR_OMISION;
}

const LOTE_ORIGINALES = 1000;

/** Primer y último día ("AAAA-MM-DD") de un rango de meses. */
export function diasDeMeses(desde: string, hasta: string): { primero: string; ultimo: string } {
  return { primero: `${desde}-01`, ultimo: sumarDias(`${sumarMeses(hasta, 1)}-01`, -1) };
}

export type LecturaMovimientos = { movs: MovimientoCajaFila[]; originales: MovimientoOriginal[] };

/**
 * Movimientos de Caja del workspace entre los meses `desde` y `hasta` (hora de Buenos Aires) y los
 * originales de cada anulación cuyo original quedó fuera del lote (siempre se leen, de cualquier mes).
 * `null` si se pasa el tope. Con `soloIngresos`, sólo ingresos y anulaciones (lo que necesita el monotributo).
 */
export async function leerMovimientosConOriginales(
  workspaceId: string,
  desde: string,
  hasta: string,
  opciones: { soloIngresos?: boolean } = {},
): Promise<LecturaMovimientos | null> {
  const filas = await prisma.cashMovement.findMany({
    where: {
      workspaceId,
      occurredAt: { gte: inicioDeMes(desde), lt: inicioDelMesSiguiente(hasta) },
      ...(opciones.soloIngresos ? { OR: [{ kind: "INGRESO" }, { reversesMovementId: { not: null } }] } : {}),
    },
    select: {
      id: true, occurredAt: true, kind: true, amountArs: true, categoryId: true,
      transferId: true, reversesMovementId: true, sourceModule: true,
    },
    take: MAX_MOVIMIENTOS_INFORME + 1,
  });
  if (filas.length > MAX_MOVIMIENTOS_INFORME) return null;
  const movs: MovimientoCajaFila[] = filas.map((f) => ({
    id: f.id,
    occurredAt: f.occurredAt,
    kind: f.kind as "INGRESO" | "EGRESO",
    centavos: decimalArsToMinor(f.amountArs),
    categoryId: f.categoryId,
    transferId: f.transferId,
    reversesMovementId: f.reversesMovementId,
    sourceModule: f.sourceModule,
  }));

  const enLote = new Set(movs.map((m) => m.id));
  const faltan = [...new Set(movs.flatMap((m) => (m.reversesMovementId && !enLote.has(m.reversesMovementId) ? [m.reversesMovementId] : [])))];
  const originales: MovimientoOriginal[] = [];
  for (let i = 0; i < faltan.length; i += LOTE_ORIGINALES) {
    const lote = await prisma.cashMovement.findMany({
      where: { workspaceId, id: { in: faltan.slice(i, i + LOTE_ORIGINALES) } },
      select: { id: true, kind: true, categoryId: true, transferId: true, sourceModule: true },
    });
    for (const o of lote) {
      originales.push({ id: o.id, kind: o.kind as "INGRESO" | "EGRESO", categoryId: o.categoryId, transferId: o.transferId, sourceModule: o.sourceModule });
    }
  }
  return { movs, originales };
}

/** Los rubros del workspace (categorías de Caja con su perfil de código y padre). */
export async function leerRubros(workspaceId: string): Promise<RubroInfo[]> {
  const filas = await prisma.cashCategory.findMany({
    where: { workspaceId },
    select: { id: true, name: true, isActive: true, fotofficeRubro: { select: { code: true, parentCategoryId: true } } },
  });
  return filas.map((c) => ({
    id: c.id,
    nombre: c.name,
    codigo: c.fotofficeRubro?.code ?? null,
    parentId: c.fotofficeRubro?.parentCategoryId ?? null,
    activo: c.isActive,
  }));
}

/** Asientos de Caja de un rango de meses, o `null` si se pasa el tope. */
export async function leerAsientosDeCaja(workspaceId: string, desde: string, hasta: string): Promise<Asiento[] | null> {
  const l = await leerMovimientosConOriginales(workspaceId, desde, hasta);
  return l ? asientosDeCaja(l.movs, l.originales) : null;
}

async function leerPedidosDevengados(workspaceId: string, desde: string, hasta: string): Promise<PedidoFila[] | null> {
  const { primero, ultimo } = diasDeMeses(desde, hasta);
  const filas = await prisma.fotofficePedido.findMany({
    where: {
      workspaceId,
      status: { not: "CANCELADO" },
      OR: [
        { eventDate: { gte: fechaParaBase(primero), lte: fechaParaBase(ultimo) } },
        { eventDate: null, createdAt: { gte: inicioDeMes(desde), lt: inicioDelMesSiguiente(hasta) } },
      ],
    },
    select: { status: true, eventDate: true, createdAt: true, totalArs: true, incomeCategoryId: true },
    take: MAX_FILAS_CUOTAS_Y_CUENTAS + 1,
  });
  if (filas.length > MAX_FILAS_CUOTAS_Y_CUENTAS) return null;
  return filas.map((p) => ({
    status: p.status,
    eventDate: p.eventDate ? fechaDeBase(p.eventDate) : null,
    createdAt: p.createdAt,
    centavos: decimalArsToMinor(p.totalArs),
    incomeCategoryId: p.incomeCategoryId,
  }));
}

async function leerCuentasDevengadas(workspaceId: string, desde: string, hasta: string): Promise<CuentaPagarFila[] | null> {
  const { primero, ultimo } = diasDeMeses(desde, hasta);
  const filas = await prisma.fotofficeCuentaPagar.findMany({
    where: {
      workspaceId,
      OR: [
        { dueDate: { gte: fechaParaBase(primero), lte: fechaParaBase(ultimo) } },
        { dueDate: null, createdAt: { gte: inicioDeMes(desde), lt: inicioDelMesSiguiente(hasta) } },
      ],
    },
    select: { dueDate: true, createdAt: true, amountArs: true, costCategoryId: true },
    take: MAX_FILAS_CUOTAS_Y_CUENTAS + 1,
  });
  if (filas.length > MAX_FILAS_CUOTAS_Y_CUENTAS) return null;
  return filas.map((c) => ({
    dueDate: c.dueDate ? fechaDeBase(c.dueDate) : null,
    createdAt: c.createdAt,
    centavos: decimalArsToMinor(c.amountArs),
    costCategoryId: c.costCategoryId,
  }));
}

export type ResultadosCargados = {
  periodo: PeriodoInforme;
  base: BaseResultados;
  /** `null` si se pasó el tope de datos (no se muestran datos parciales). */
  matriz: MatrizResultados | null;
  /** Cuántos asientos entraron (0 = nada en el período: la pantalla dice que no hay movimientos). */
  cantidadAsientos: number;
  avisos: string[];
};

/** Resultados por rubro y mes. `null` si la persona no tiene permiso (no se lee nada). */
export async function cargarResultados(
  ctx: CtxInformes,
  params: { periodo?: string | null; base?: string | null } = {},
  ahora: Date = new Date(),
): Promise<ResultadosCargados | null> {
  if (!puedeVerInformes(ctx)) return null;
  const { workspaceId } = ctx;
  const periodo = periodoInforme({ periodo: params.periodo, hoy: hoyEnBuenosAires(ahora) });
  const base = baseElegida(params.base);
  const avisos = periodo.aviso ? [periodo.aviso] : [];
  const vacio: ResultadosCargados = { periodo, base, matriz: null, cantidadAsientos: 0, avisos: [...avisos, AVISO_DEMASIADOS_DATOS] };

  const lectura = await leerMovimientosConOriginales(workspaceId, periodo.desde, periodo.hasta);
  if (!lectura) return vacio;

  let asientos: Asiento[];
  if (base === "caja") {
    asientos = asientosDeCaja(lectura.movs, lectura.originales);
  } else {
    const [pedidos, cuentas] = await Promise.all([
      leerPedidosDevengados(workspaceId, periodo.desde, periodo.hasta),
      leerCuentasDevengadas(workspaceId, periodo.desde, periodo.hasta),
    ]);
    if (!pedidos || !cuentas) return vacio;
    asientos = asientosDevengados({ pedidos, cuentas, movs: lectura.movs, originales: lectura.originales });
  }
  const rubros = await leerRubros(workspaceId);
  return { periodo, base, matriz: armarResultados({ meses: periodo.meses, rubros, asientos }), cantidadAsientos: asientos.length, avisos };
}
