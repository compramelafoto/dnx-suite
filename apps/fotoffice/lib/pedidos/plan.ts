import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { decimalArsToMinor, minorToDecimalString } from "@/lib/membership/money";
import { MENSAJES_PEDIDO, puedeGestionarPedidos, type CtxPedidos } from "./acceso";
import { esEstadoPedido, esMedioCobro, type MedioCobro } from "./constantes";
import { imputadoPorCuota, type CuotaLeida, type ImputacionLeida } from "./estado";
import { aCentavos, desdeCentavos, esFechaValida, tieneHastaDosDecimales, validarPlan } from "./plan-cuotas";

/**
 * Plan de cuotas de un pedido en la base (etapa 3, Entrega A): escribir, leer y editar.
 *
 * - Las fechas de vencimiento son días de Argentina ("aaaa-mm-dd") guardados como DATE
 *   (medianoche UTC).
 * - El dinero viaja en pesos con dos decimales y se guarda como texto exacto en el `Decimal`
 *   (`minorToDecimalString`), nunca como flotante.
 * - Editar el plan va con el candado del pedido (`bloquearPedido`), el mismo que usan los cobros:
 *   así una cuota no se quita mientras otro la está cobrando.
 *
 * Nunca loguea datos personales.
 */

type Tx = Prisma.TransactionClient;

export type Resultado = { ok: true } | { ok: false; error: string };

/** Candado por pedido: serializa editar el plan, cambiar el estado y cobrar el mismo pedido. */
export function bloquearPedido(tx: Tx, pedidoId: string) {
  return tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fotoffice-pedido:${pedidoId}`}))`;
}

/** "aaaa-mm-dd" → valor de una columna DATE (medianoche UTC). */
export function fechaParaBase(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

/** Columna DATE → "aaaa-mm-dd". */
export function fechaDeBase(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** `Decimal` (o su texto) → pesos con dos decimales. */
export function pesosDeBase(v: { toString(): string }): number {
  return desdeCentavos(decimalArsToMinor(v));
}

/** Pesos → texto exacto para un `Decimal(12,2)`. */
export function pesosParaBase(pesos: number): string {
  return minorToDecimalString(aCentavos(pesos));
}

function idValido(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 64;
}

function falla(donde: string, error: unknown): void {
  const e = error as { code?: unknown } | null;
  console.error(`[pedidos] ${donde} falló`, { codigo: typeof e?.code === "string" ? e.code : null });
}

// --- Escribir ---------------------------------------------------------------------------------

export type CuotaParaGuardar = { dueDate: string; amountArs: number; suggestedMethod?: MedioCobro | null };

/** Crea las cuotas de un pedido (posiciones 1…N en el orden recibido). */
export async function crearCuotas(
  tx: Pick<Tx, "fotofficePedidoCuota">,
  args: { workspaceId: string; pedidoId: string; cuotas: readonly CuotaParaGuardar[] },
): Promise<void> {
  if (args.cuotas.length === 0) return;
  await tx.fotofficePedidoCuota.createMany({
    data: args.cuotas.map((c, i) => ({
      workspaceId: args.workspaceId,
      pedidoId: args.pedidoId,
      position: i + 1,
      dueDate: fechaParaBase(c.dueDate),
      amountArs: pesosParaBase(c.amountArs),
      suggestedMethod: c.suggestedMethod ?? null,
    })),
  });
}

// --- Leer -------------------------------------------------------------------------------------

type Lector = Pick<Tx, "fotofficePedidoCuota" | "fotofficeCobroImputacion" | "fotofficeCobro">;

export type PlanLeido = { cuotas: CuotaLeida[]; imputaciones: ImputacionLeida[] };

/**
 * Cuotas e imputaciones de varios pedidos del workspace, por pedido. Las imputaciones vienen con
 * la marca `anulada` (su cobro tiene `voidedAt`): `resumenDePlan` las descarta.
 */
export async function planesDe(workspaceId: string, pedidoIds: readonly string[], cliente: Lector = prisma): Promise<Map<string, PlanLeido>> {
  const mapa = new Map<string, PlanLeido>();
  const ids = [...new Set(pedidoIds)];
  if (ids.length === 0) return mapa;
  for (const id of ids) mapa.set(id, { cuotas: [], imputaciones: [] });
  const cuotas = await cliente.fotofficePedidoCuota.findMany({
    where: { workspaceId, pedidoId: { in: ids } },
    orderBy: [{ position: "asc" }],
    select: { id: true, pedidoId: true, position: true, dueDate: true, amountArs: true, suggestedMethod: true },
  });
  const pedidoDeCuota = new Map<string, string>();
  for (const c of cuotas) {
    pedidoDeCuota.set(c.id, c.pedidoId);
    mapa.get(c.pedidoId)?.cuotas.push({
      id: c.id,
      position: c.position,
      dueDate: fechaDeBase(c.dueDate),
      amountArs: pesosDeBase(c.amountArs),
      suggestedMethod: c.suggestedMethod,
    });
  }
  if (cuotas.length === 0) return mapa;
  const imputaciones = await cliente.fotofficeCobroImputacion.findMany({
    where: { workspaceId, cuotaId: { in: cuotas.map((c) => c.id) } },
    select: { cobroId: true, cuotaId: true, amountArs: true },
  });
  if (imputaciones.length === 0) return mapa;
  const cobros = await cliente.fotofficeCobro.findMany({
    where: { workspaceId, id: { in: [...new Set(imputaciones.map((i) => i.cobroId))] } },
    select: { id: true, voidedAt: true },
  });
  const anulado = new Map(cobros.map((c) => [c.id, c.voidedAt !== null]));
  for (const i of imputaciones) {
    const pedidoId = pedidoDeCuota.get(i.cuotaId);
    if (!pedidoId) continue;
    // Un cobro que no se encuentra en el workspace no cuenta (como uno anulado).
    mapa.get(pedidoId)?.imputaciones.push({ cuotaId: i.cuotaId, amountArs: pesosDeBase(i.amountArs), anulada: anulado.get(i.cobroId) ?? true });
  }
  return mapa;
}

// --- Validar lo que llega ---------------------------------------------------------------------

export const MAX_CUOTAS_PEDIDO = 60;

/** Una cuota del plan editado. Con `id`, una cuota que ya existe; sin `id`, una nueva. */
export type CuotaEditada = { id: string | null; dueDate: string; amountArs: number; suggestedMethod: MedioCobro | null };

/**
 * Revisa la forma de un plan que llega del navegador (no la suma: eso es `validarPlan`). Acepta
 * importes con hasta dos decimales y fechas reales.
 */
export function leerCuotasEditadas(raw: unknown): { ok: true; valor: CuotaEditada[] } | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length > MAX_CUOTAS_PEDIDO) return { ok: false, error: MENSAJES_PEDIDO.datosInvalidos };
  const out: CuotaEditada[] = [];
  for (const [i, x] of raw.entries()) {
    if (!x || typeof x !== "object" || Array.isArray(x)) return { ok: false, error: MENSAJES_PEDIDO.datosInvalidos };
    const r = x as Record<string, unknown>;
    const id = r.id === undefined || r.id === null || r.id === "" ? null : r.id;
    if (id !== null && !idValido(id)) return { ok: false, error: MENSAJES_PEDIDO.datosInvalidos };
    if (!esFechaValida(r.dueDate)) return { ok: false, error: `La cuota ${i + 1} no tiene una fecha válida.` };
    if (typeof r.amountArs !== "number" || !tieneHastaDosDecimales(r.amountArs) || aCentavos(r.amountArs) <= 0) {
      return { ok: false, error: `El importe de la cuota ${i + 1} tiene que ser mayor que cero.` };
    }
    const medio = r.suggestedMethod === undefined || r.suggestedMethod === null || r.suggestedMethod === "" ? null : r.suggestedMethod;
    if (medio !== null && !esMedioCobro(medio)) return { ok: false, error: MENSAJES_PEDIDO.medio };
    out.push({ id, dueDate: r.dueDate, amountArs: desdeCentavos(aCentavos(r.amountArs)), suggestedMethod: medio });
  }
  return { ok: true, valor: out };
}

// --- Editar -----------------------------------------------------------------------------------

class Corte extends Error {
  constructor(readonly mensaje: string) {
    super(mensaje);
  }
}

/**
 * "Editar plan": reemplaza el plan por `cuotas`, en ese orden (las posiciones se renumeran).
 * - las cuotas sin imputaciones se cambian, se quitan o se agregan libremente;
 * - una cuota con imputaciones (de cobros sin anular) no se quita y su importe no baja de lo
 *   imputado;
 * - la suma tiene que dar el total del pedido (a centavos);
 * - un pedido cancelado no se edita.
 */
export async function editarPlan(ctx: CtxPedidos, pedidoId: unknown, cuotasRaw: unknown): Promise<Resultado> {
  if (!puedeGestionarPedidos(ctx)) return { ok: false, error: MENSAJES_PEDIDO.sinPermiso };
  if (!idValido(pedidoId)) return { ok: false, error: MENSAJES_PEDIDO.datosInvalidos };
  const leidas = leerCuotasEditadas(cuotasRaw);
  if (!leidas.ok) return leidas;
  const cuotas = leidas.valor;
  const { workspaceId } = ctx;

  try {
    return await prisma.$transaction(async (tx): Promise<Resultado> => {
      await bloquearPedido(tx, pedidoId);
      const p = await tx.fotofficePedido.findFirst({ where: { id: pedidoId, workspaceId }, select: { id: true, status: true, totalArs: true } });
      if (!p || !esEstadoPedido(p.status)) throw new Corte(MENSAJES_PEDIDO.noExiste);
      if (p.status === "CANCELADO") throw new Corte(MENSAJES_PEDIDO.cancelado);
      const total = pesosDeBase(p.totalArs);
      const suma = validarPlan(cuotas, total);
      if (!suma.ok) throw new Corte(suma.error);

      const plan = (await planesDe(workspaceId, [pedidoId], tx)).get(pedidoId)!;
      const existentes = new Map(plan.cuotas.map((c) => [c.id, c]));
      const imputado = imputadoPorCuota(plan.imputaciones);
      // Las imputaciones de cobros anulados igual frenan el borrado (la FK es RESTRICT): esas
      // cuotas se conservan aunque no tengan nada vigente.
      const conImputaciones = new Set(plan.imputaciones.map((i) => i.cuotaId));

      const vistas = new Set<string>();
      for (const c of cuotas) {
        if (c.id === null) continue;
        if (!existentes.has(c.id)) throw new Corte(MENSAJES_PEDIDO.cuotaAjena);
        if (vistas.has(c.id)) throw new Corte(MENSAJES_PEDIDO.datosInvalidos);
        vistas.add(c.id);
        if (aCentavos(c.amountArs) < (imputado.get(c.id) ?? 0)) throw new Corte(MENSAJES_PEDIDO.menosQueImputado);
      }
      const quitar = plan.cuotas.filter((c) => !vistas.has(c.id));
      if (quitar.some((c) => conImputaciones.has(c.id))) throw new Corte(MENSAJES_PEDIDO.cuotaConCobros);

      if (quitar.length > 0) {
        await tx.fotofficePedidoCuota.deleteMany({ where: { workspaceId, pedidoId, id: { in: quitar.map((c) => c.id) } } });
      }
      for (const [i, c] of cuotas.entries()) {
        const datos = {
          position: i + 1,
          dueDate: fechaParaBase(c.dueDate),
          amountArs: pesosParaBase(c.amountArs),
          suggestedMethod: c.suggestedMethod,
        };
        if (c.id !== null) {
          await tx.fotofficePedidoCuota.update({ where: { id: c.id }, data: datos, select: { id: true } });
        } else {
          await tx.fotofficePedidoCuota.create({ data: { ...datos, workspaceId, pedidoId }, select: { id: true } });
        }
      }
      await tx.fotofficePedido.update({ where: { id: pedidoId }, data: { updatedAt: new Date() }, select: { id: true } });
      return { ok: true };
    });
  } catch (e) {
    if (e instanceof Corte) return { ok: false, error: e.mensaje };
    falla("editarPlan", e);
    return { ok: false, error: MENSAJES_PEDIDO.fallo };
  }
}
