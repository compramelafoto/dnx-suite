import "server-only";
import { prisma } from "@repo/db";
import { balancesByAccountMinor } from "@/lib/cash/balance";
import { hoyEnBuenosAires } from "@/lib/listado/periodos";
import { decimalArsToMinor } from "@/lib/membership/money";
import { esEstadoPedido } from "@/lib/pedidos/constantes";
import { resumenDePlan } from "@/lib/pedidos/estado";
import { fechaDeBase, fechaParaBase, pesosDeBase, planesDe } from "@/lib/pedidos/plan";
import { puedeVerInformes, type CtxInformes } from "./acceso";
import { leerAjustesInformes } from "./ajustes";
import { AVISO_DEMASIADOS_DATOS, MAX_FILAS_CUOTAS_Y_CUENTAS } from "./constantes";
import { sumarDias } from "./fechas";
import { armarFlujo, type AgrupacionFlujo, type CuentaFlujo, type CuotaFlujo, type FlujoProyectado } from "./flujo";
import { mesDeDia, sumarMeses } from "./periodos";

/**
 * Lectura del flujo de caja proyectado (etapa 6). El horizonte se limita a 12 meses: así la
 * agrupación por día no pasa de unas 367 filas (el cálculo puro corta en 400). Las cuotas y cuentas
 * posteriores al horizonte no se leen.
 */

export const HORIZONTES_FLUJO = ["7d", "1m", "3m", "6m", "12m"] as const;
export type HorizonteFlujo = (typeof HORIZONTES_FLUJO)[number];
export const HORIZONTE_FLUJO_POR_OMISION: HorizonteFlujo = "3m";
export const ETIQUETAS_HORIZONTE: Record<HorizonteFlujo, string> = {
  "7d": "7 días",
  "1m": "1 mes",
  "3m": "3 meses",
  "6m": "6 meses",
  "12m": "12 meses",
};
export const AGRUPACIONES_FLUJO: readonly AgrupacionFlujo[] = ["dia", "semana", "mes"];
export const AGRUPACION_FLUJO_POR_OMISION: AgrupacionFlujo = "semana";

export function horizonteElegido(v: unknown): HorizonteFlujo {
  return (HORIZONTES_FLUJO as readonly unknown[]).includes(v) ? (v as HorizonteFlujo) : HORIZONTE_FLUJO_POR_OMISION;
}

export function agrupacionElegida(v: unknown): AgrupacionFlujo {
  return (AGRUPACIONES_FLUJO as readonly unknown[]).includes(v) ? (v as AgrupacionFlujo) : AGRUPACION_FLUJO_POR_OMISION;
}

function ultimoDiaDelMes(mes: string): string {
  return sumarDias(`${sumarMeses(mes, 1)}-01`, -1);
}

/** Último día incluido del horizonte: hoy + 7 días, o hoy + N meses (el mismo día, o el último del mes). */
export function hastaDeHorizonte(hoy: string, horizonte: HorizonteFlujo): string {
  if (horizonte === "7d") return sumarDias(hoy, 7);
  const n = Number(horizonte.slice(0, -1));
  const mes = sumarMeses(mesDeDia(hoy), n);
  const ultimo = ultimoDiaDelMes(mes);
  const mismo = `${mes}-${hoy.slice(8, 10)}`;
  return mismo > ultimo ? ultimo : mismo;
}

export const ESTADOS_A_COBRAR = ["CONFIRMADO", "EN_CURSO", "COMPLETADO"];
const LOTE = 1000;

/**
 * Saldo de cada cuota con saldo pendiente (de pedidos CONFIRMADO, EN_CURSO o COMPLETADO) que vence
 * hasta `hasta` (las vencidas incluidas). `null` si se pasa el tope.
 */
export async function leerCuotasPorCobrar(workspaceId: string, hasta: string): Promise<CuotaFlujo[] | null> {
  const hoyBase = hoyEnBuenosAires();
  const pedidos = await prisma.fotofficePedido.findMany({
    where: {
      workspaceId,
      status: { in: ESTADOS_A_COBRAR },
      cuotas: { some: { workspaceId, dueDate: { lte: fechaParaBase(hasta) } } },
    },
    select: { id: true, status: true, totalArs: true },
    take: MAX_FILAS_CUOTAS_Y_CUENTAS + 1,
  });
  if (pedidos.length > MAX_FILAS_CUOTAS_Y_CUENTAS) return null;
  const cuotas: CuotaFlujo[] = [];
  for (let i = 0; i < pedidos.length; i += LOTE) {
    const lote = pedidos.slice(i, i + LOTE);
    const planes = await planesDe(workspaceId, lote.map((p) => p.id));
    for (const p of lote) {
      if (!esEstadoPedido(p.status)) continue;
      const plan = planes.get(p.id) ?? { cuotas: [], imputaciones: [] };
      const r = resumenDePlan(plan.cuotas, plan.imputaciones, { hoy: hoyBase, estadoPedido: p.status, total: pesosDeBase(p.totalArs) });
      for (const c of r.cuotas) {
        const saldoCentavos = Math.round(c.saldo * 100);
        if (saldoCentavos > 0 && c.dueDate <= hasta) cuotas.push({ dueDate: c.dueDate, saldoCentavos });
      }
    }
    if (cuotas.length > MAX_FILAS_CUOTAS_Y_CUENTAS) return null;
  }
  return cuotas;
}

/** Cuentas a pagar sin pago vigente que vencen hasta `hasta` o no tienen fecha. `null` si se pasa el tope. */
export async function leerCuentasPorPagar(workspaceId: string, hasta: string): Promise<CuentaFlujo[] | null> {
  const filas = await prisma.fotofficeCuentaPagar.findMany({
    where: { workspaceId, paidAt: null, OR: [{ dueDate: null }, { dueDate: { lte: fechaParaBase(hasta) } }] },
    select: { dueDate: true, amountArs: true },
    take: MAX_FILAS_CUOTAS_Y_CUENTAS + 1,
  });
  if (filas.length > MAX_FILAS_CUOTAS_Y_CUENTAS) return null;
  return filas.map((c) => ({ dueDate: c.dueDate ? fechaDeBase(c.dueDate) : null, centavos: decimalArsToMinor(c.amountArs) }));
}

export type SaldoCuenta = { id: string; nombre: string; esBoveda: boolean; centavos: number };
export type SaldosDeCaja = { cuentas: SaldoCuenta[]; total: number };

/** Saldo de cada cuenta de Caja ACTIVA del workspace (transferencias incluidas) y el total. */
export async function leerSaldosDeCaja(workspaceId: string): Promise<SaldosDeCaja> {
  const cuentas = await prisma.cashAccount.findMany({
    where: { workspaceId, isActive: true },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: { id: true, name: true, isVault: true },
  });
  if (cuentas.length === 0) return { cuentas: [], total: 0 };
  const grupos = await prisma.cashMovement.groupBy({
    by: ["accountId", "kind"],
    where: { workspaceId, accountId: { in: cuentas.map((c) => c.id) } },
    _sum: { amountArs: true },
  });
  const saldos = balancesByAccountMinor(
    cuentas.map((c) => c.id),
    grupos.map((g) => ({ accountId: g.accountId, kind: g.kind as "INGRESO" | "EGRESO", amountMinor: g._sum.amountArs ? decimalArsToMinor(g._sum.amountArs) : 0 })),
  );
  const filas = cuentas.map((c) => ({ id: c.id, nombre: c.name, esBoveda: c.isVault, centavos: saldos.get(c.id) ?? 0 }));
  return { cuentas: filas, total: filas.reduce((s, c) => s + c.centavos, 0) };
}

export type FlujoCargado = {
  hoy: string;
  agrupar: AgrupacionFlujo;
  horizonte: HorizonteFlujo;
  hasta: string;
  /** Saldo mínimo configurado (centavos) o `null`. */
  saldoMinimo: number | null;
  /** `null` si se pasó el tope de datos. */
  flujo: FlujoProyectado | null;
  avisos: string[];
};

/** Flujo de caja proyectado. `null` si la persona no tiene permiso (no se lee nada). */
export async function cargarFlujo(
  ctx: CtxInformes,
  params: { agrupar?: string | null; horizonte?: string | null } = {},
  ahora: Date = new Date(),
): Promise<FlujoCargado | null> {
  if (!puedeVerInformes(ctx)) return null;
  const { workspaceId } = ctx;
  const hoy = hoyEnBuenosAires(ahora);
  const agrupar = agrupacionElegida(params.agrupar);
  const horizonte = horizonteElegido(params.horizonte);
  const hasta = hastaDeHorizonte(hoy, horizonte);
  const [ajustes, cuotas, cuentas, saldos] = await Promise.all([
    leerAjustesInformes(workspaceId),
    leerCuotasPorCobrar(workspaceId, hasta),
    leerCuentasPorPagar(workspaceId, hasta),
    leerSaldosDeCaja(workspaceId),
  ]);
  const base = { hoy, agrupar, horizonte, hasta, saldoMinimo: ajustes.minBalanceCentavos };
  if (!cuotas || !cuentas) return { ...base, flujo: null, avisos: [AVISO_DEMASIADOS_DATOS] };
  const flujo = armarFlujo({ hoy, agrupar, hasta, saldoCaja: saldos.total, cuotas, cuentas, saldoMinimo: ajustes.minBalanceCentavos });
  return { ...base, flujo, avisos: [] };
}
