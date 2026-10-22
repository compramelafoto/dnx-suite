import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { decimalArsToMinor } from "@/lib/membership/money";
import { pendingFeeDebtMinor, recordEntryReturningId } from "@/lib/platform-fee/ledger";
import { getPlatformFeeBps } from "@/lib/platform-fee/store";
import {
  cobrosQueDevengan,
  descargaDeDeuda,
  inicioDelMesArgentino,
  notaDevengado,
  notaReverso,
  notaRetenido,
  type Retencion,
} from "../comision";
import { DIGITALIZACION_MODULE_KEY } from "../constants";

/**
 * La comisión de plataforma sobre los pedidos de digitalización de otros negocios (spec 2026-10-22,
 * F1), del lado del servidor. Mismo libro que socios y reservas (`WorkspaceFeeLedgerEntry`).
 *
 * - **Qué pedido:** el que tiene `DigitalizacionEntrega` o algún trabajo con grabaciones (no descartadas).
 * - **Cobro manual**, o de Mercado Pago sin retención (abierto antes de la entrega): DEVENGADO por la
 *   comisión entera, después del commit del cobro y sin lanzar. Al crearse la entrega se devengan los
 *   cobros que el pedido ya tenía (la seña se cobra antes de grabar).
 * - **Mercado Pago con retención:** en la MISMA transacción del cobro, un asiento RETENIDO por la parte
 *   que canceló deuda (retenido − propio, acotado a la deuda de ese momento). Ese asiento puede ser
 *   de 0 pesos: es la marca de que el cobro ya pagó su comisión (ver `retenerEnTx`).
 * - **Marca:** cada cobro con comisión tiene su `DigitalizacionComision` (`cobroId` único): así nunca
 *   se devenga dos veces, ni entre el cobro, la entrega y los crons a la vez.
 * - **Anular un cobro** con un DEVENGADO: asiento REVERSADO por el mismo monto en negativo, y la marca
 *   pasa a apuntar a ese reverso (sigue existiendo, así el cobro no se vuelve a devengar; y si ya no
 *   apunta a un DEVENGADO, es que ya se revirtió). Las retenciones de Mercado Pago no se tocan:
 *   anular el cobro en FOTOFFICE no prueba que Mercado Pago haya devuelto la comisión.
 * - **0 bps** (DNX, que es la plataforma): nada en ningún camino.
 * - Los crons de Digitalización concilian lo que el camino rápido no llegó a hacer (`conciliarComisiones`).
 *
 * Nada de esto lanza hacia el cobro: si falla, el cobro igual queda hecho. Nunca loguea datos personales.
 */

type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

function codigo(e: unknown): string {
  const c = e as { code?: unknown; name?: unknown } | null;
  return typeof c?.code === "string" ? c.code : typeof c?.name === "string" ? c.name : "desconocido";
}

/** ¿Es un pedido de digitalización? Tiene entrega, o algún trabajo con grabaciones no descartadas. */
export async function esPedidoDeDigitalizacion(workspaceId: string, pedidoId: string, db: Db = prisma): Promise<boolean> {
  const entrega = await db.digitalizacionEntrega.findFirst({ where: { pedidoId, workspaceId }, select: { id: true } });
  if (entrega) return true;
  const grabacion = await db.digitalizacionGrabacion.findFirst({
    where: { workspaceId, estado: { not: "DESCARTADA" }, proyecto: { pedidoId, workspaceId } },
    select: { id: true },
  });
  return grabacion !== null;
}

/** La tasa de digitalización del negocio (0 = DNX: no hay comisión). */
export function tasaDeDigitalizacion(workspaceId: string): Promise<number> {
  return getPlatformFeeBps(workspaceId, DIGITALIZACION_MODULE_KEY);
}

type CobroLeido = { id: string; pedidoId: string; amountArs: { toString(): string }; voidedAt: Date | null; receiptNumber: string };
const SELECT_COBRO = { id: true, pedidoId: true, amountArs: true, voidedAt: true, receiptNumber: true } as const;

/** Devenga los cobros pendientes de un negocio (marca + asiento juntos). Devuelve cuántos devengó. */
async function devengarCobros(workspaceId: string, bps: number, cobros: readonly CobroLeido[], numeros: ReadonlyMap<string, string>): Promise<number> {
  if (bps <= 0 || cobros.length === 0) return 0;
  const marcas = await prisma.digitalizacionComision.findMany({ where: { cobroId: { in: cobros.map((c) => c.id) } }, select: { cobroId: true } });
  const pendientes = cobrosQueDevengan(
    cobros.map((c) => ({ id: c.id, voidedAt: c.voidedAt, amountMinor: decimalArsToMinor(c.amountArs) })),
    new Set(marcas.map((m) => m.cobroId)),
    bps,
  );
  const porId = new Map(cobros.map((c) => [c.id, c]));
  let hechos = 0;
  for (const p of pendientes) {
    const c = porId.get(p.id)!;
    try {
      await prisma.$transaction(async (tx) => {
        const ledgerEntryId = await recordEntryReturningId(tx, {
          workspaceId,
          kind: "DEVENGADO",
          signedAmountMinor: p.comisionMinor,
          note: notaDevengado({ bps, pedidoNumero: numeros.get(c.pedidoId) ?? "sin número", recibo: c.receiptNumber, comisionMinor: p.comisionMinor }),
        });
        await tx.digitalizacionComision.create({ data: { workspaceId, cobroId: c.id, ledgerEntryId }, select: { id: true } });
      });
      hechos++;
    } catch (e) {
      // Otra corrida lo marcó en el medio (el único de `cobroId`): su asiento se deshizo con la transacción.
      if (codigo(e) === "P2002") continue;
      console.error("[digitalizacion][comision] no se pudo devengar la comisión de un cobro", { codigo: codigo(e) });
    }
  }
  return hechos;
}

/**
 * Devenga la comisión de los cobros vigentes del pedido que todavía no la tienen. Lo llaman el cobro
 * (después del commit) y la creación de la entrega. Idempotente. Nunca lanza.
 */
export async function devengarComisionesDelPedido(workspaceId: string, pedidoId: string): Promise<number> {
  try {
    if (!(await esPedidoDeDigitalizacion(workspaceId, pedidoId))) return 0;
    const bps = await tasaDeDigitalizacion(workspaceId);
    if (bps <= 0) return 0;
    const pedido = await prisma.fotofficePedido.findFirst({ where: { id: pedidoId, workspaceId }, select: { id: true, number: true } });
    if (!pedido) return 0;
    const cobros = await prisma.fotofficeCobro.findMany({ where: { workspaceId, pedidoId, voidedAt: null }, select: SELECT_COBRO });
    return await devengarCobros(workspaceId, bps, cobros, new Map([[pedido.id, pedido.number]]));
  } catch (e) {
    console.error("[digitalizacion][comision] falló el devengamiento de un pedido", { codigo: codigo(e) });
    return 0;
  }
}

/**
 * La retención de un pago de Mercado Pago, dentro de la transacción del cobro: asiento RETENIDO por
 * la parte que canceló deuda (puede ser 0: el pago sólo retuvo su propia comisión) y la marca del
 * cobro. Si lanza, se deshace el cobro entero (queda como cualquier falla de la acreditación: tarea
 * para el equipo, y un aviso repetido o la vuelta del comprador reintentan): así un cobro con
 * retención nunca queda sin marca (y nunca se devengaría encima de lo retenido).
 */
export async function retenerEnTx(
  tx: Tx,
  input: { workspaceId: string; pedidoId: string; cobroId: string; reciboNumero: string; retencion: Retencion; bps: number },
): Promise<void> {
  const { workspaceId, retencion } = input;
  const deuda = await pendingFeeDebtMinor(workspaceId, tx);
  const descarga = descargaDeDeuda({ retenidoMinor: retencion.retenidoMinor, propioMinor: retencion.propioMinor, deudaMinor: deuda });
  const pedido = await tx.fotofficePedido.findFirst({ where: { id: input.pedidoId, workspaceId }, select: { number: true } });
  const ledgerEntryId = await recordEntryReturningId(tx, {
    workspaceId,
    kind: "RETENIDO",
    signedAmountMinor: -descarga,
    note: notaRetenido({
      bps: input.bps, pedidoNumero: pedido?.number ?? "sin número", recibo: input.reciboNumero,
      retenidoMinor: retencion.retenidoMinor, propioMinor: retencion.propioMinor, descargaMinor: descarga,
    }),
  });
  await tx.digitalizacionComision.create({ data: { workspaceId, cobroId: input.cobroId, ledgerEntryId }, select: { id: true } });
}

class YaRevertida extends Error {
  constructor() {
    super("ya revertida");
  }
}

/**
 * Un cobro anulado que había devengado comisión: asiento REVERSADO por el mismo monto en negativo
 * (el libro es firmado: así la deuda vuelve a lo que era) y la marca pasa a apuntar al reverso, en la
 * misma transacción y con la condición de que todavía apunte al devengado: dos corridas a la vez no
 * revierten dos veces. No toca las retenciones de Mercado Pago. Nunca lanza.
 */
export async function revertirComisionDelCobro(workspaceId: string, cobroId: string): Promise<boolean> {
  try {
    const marca = await prisma.digitalizacionComision.findFirst({ where: { cobroId, workspaceId }, select: { ledgerEntryId: true } });
    if (!marca) return false;
    const asiento = await prisma.workspaceFeeLedgerEntry.findFirst({ where: { id: marca.ledgerEntryId, workspaceId }, select: { id: true, kind: true, amountArs: true } });
    if (!asiento || asiento.kind !== "DEVENGADO") return false;
    const cobro = await prisma.fotofficeCobro.findFirst({ where: { id: cobroId, workspaceId }, select: { pedidoId: true, receiptNumber: true, voidedAt: true } });
    if (!cobro?.voidedAt) return false;
    const pedido = await prisma.fotofficePedido.findFirst({ where: { id: cobro.pedidoId, workspaceId }, select: { number: true } });
    const monto = decimalArsToMinor(asiento.amountArs);
    if (monto <= 0) return false;
    await prisma.$transaction(async (tx) => {
      const reverso = await recordEntryReturningId(tx, {
        workspaceId,
        kind: "REVERSADO",
        signedAmountMinor: -monto,
        note: notaReverso({ pedidoNumero: pedido?.number ?? "sin número", recibo: cobro.receiptNumber }),
      });
      const r = await tx.digitalizacionComision.updateMany({ where: { cobroId, workspaceId, ledgerEntryId: asiento.id }, data: { ledgerEntryId: reverso } });
      if (r.count !== 1) throw new YaRevertida();
    });
    return true;
  } catch (e) {
    if (e instanceof YaRevertida) return false;
    console.error("[digitalizacion][comision] no se pudo revertir la comisión de un cobro anulado", { codigo: codigo(e) });
    return false;
  }
}

// --- Conciliación (crons) ---------------------------------------------------------------------

export type ReporteComisiones = { devengadas: number; revertidas: number };

/** Grabaciones de los últimos días que todavía pueden no tener entrega (la entrega nace con el primer video listo). */
const DIAS_GRABACIONES_SIN_ENTREGA = 60;
const DIA_MS = 24 * 60 * 60 * 1000;

/** Los pedidos de digitalización, por negocio: los de las entregas y los de grabaciones recientes. */
async function pedidosDeDigitalizacion(ahora: Date): Promise<Map<string, Set<string>>> {
  const desde = new Date(ahora.getTime() - DIAS_GRABACIONES_SIN_ENTREGA * DIA_MS);
  const [entregas, grabaciones] = await Promise.all([
    prisma.digitalizacionEntrega.findMany({ select: { pedidoId: true, workspaceId: true } }),
    prisma.digitalizacionGrabacion.findMany({
      where: { proyectoId: { not: null }, estado: { not: "DESCARTADA" }, iniciadaAt: { gte: desde } },
      select: { proyectoId: true },
    }),
  ]);
  const proyectoIds = [...new Set(grabaciones.map((g) => g.proyectoId).filter((id): id is string => id !== null))];
  const proyectos = proyectoIds.length
    ? await prisma.fotofficeProyecto.findMany({ where: { id: { in: proyectoIds } }, select: { pedidoId: true, workspaceId: true } })
    : [];
  const porNegocio = new Map<string, Set<string>>();
  const sumar = (ws: string, pedidoId: string | null) => {
    if (!pedidoId) return;
    if (!porNegocio.has(ws)) porNegocio.set(ws, new Set());
    porNegocio.get(ws)!.add(pedidoId);
  };
  for (const e of entregas) sumar(e.workspaceId, e.pedidoId);
  for (const p of proyectos) sumar(p.workspaceId, p.pedidoId);
  return porNegocio;
}

/**
 * Lo que el camino rápido no llegó a hacer (corre después del commit y sin reintento):
 * - devenga los cobros vigentes de pedidos de digitalización sin marca (los de Mercado Pago con
 *   retención siempre la tienen: nace en la transacción del cobro);
 * - revierte los devengados de cobros anulados (aunque la tasa de hoy sea 0).
 * Nunca lanza; devuelve contadores.
 */
export async function conciliarComisiones(deps: { ahora?: () => Date } = {}): Promise<ReporteComisiones> {
  const ahora = (deps.ahora ?? (() => new Date()))();
  const reporte: ReporteComisiones = { devengadas: 0, revertidas: 0 };
  let porNegocio: Map<string, Set<string>>;
  try {
    porNegocio = await pedidosDeDigitalizacion(ahora);
  } catch (e) {
    console.error("[digitalizacion][comision] falló la búsqueda de pedidos para conciliar", { codigo: codigo(e) });
    return reporte;
  }
  for (const [workspaceId, pedidos] of porNegocio) {
    try {
      // Reversos: sólo los negocios con marcas (DNX nunca tiene).
      const marcas = await prisma.digitalizacionComision.findMany({ where: { workspaceId }, select: { cobroId: true, ledgerEntryId: true } });
      if (marcas.length) {
        const devengados = await prisma.workspaceFeeLedgerEntry.findMany({
          where: { workspaceId, kind: "DEVENGADO", id: { in: marcas.map((m) => m.ledgerEntryId) } },
          select: { id: true },
        });
        const conDevengado = new Set(devengados.map((d) => d.id));
        const cobroIds = marcas.filter((m) => conDevengado.has(m.ledgerEntryId)).map((m) => m.cobroId);
        const anulados = cobroIds.length
          ? await prisma.fotofficeCobro.findMany({ where: { workspaceId, id: { in: cobroIds }, voidedAt: { not: null } }, select: { id: true } })
          : [];
        for (const c of anulados) if (await revertirComisionDelCobro(workspaceId, c.id)) reporte.revertidas++;
      }
      const bps = await tasaDeDigitalizacion(workspaceId);
      if (bps <= 0) continue;
      const ids = [...pedidos];
      const [cobros, numeros] = await Promise.all([
        prisma.fotofficeCobro.findMany({ where: { workspaceId, pedidoId: { in: ids }, voidedAt: null }, select: SELECT_COBRO }),
        prisma.fotofficePedido.findMany({ where: { workspaceId, id: { in: ids } }, select: { id: true, number: true } }),
      ]);
      reporte.devengadas += await devengarCobros(workspaceId, bps, cobros, new Map(numeros.map((p) => [p.id, p.number])));
    } catch (e) {
      console.error("[digitalizacion][comision] falló la conciliación de un negocio", { codigo: codigo(e) });
    }
  }
  return reporte;
}

// --- Visibilidad ------------------------------------------------------------------------------

export type ResumenComision = { devengadoMesMinor: number; saldoPendienteMinor: number };

/**
 * Para la lista interna (MANAGE): lo devengado este mes (hora argentina) por cobros de
 * digitalización y la deuda pendiente del negocio con la plataforma (todo el libro). null con 0 bps:
 * DNX no ve nada. Un devengado revertido ya no cuenta (su marca apunta al reverso).
 */
export async function resumenDeComision(workspaceId: string, ahora: Date = new Date()): Promise<ResumenComision | null> {
  const bps = await tasaDeDigitalizacion(workspaceId);
  if (bps <= 0) return null;
  const desde = inicioDelMesArgentino(ahora);
  const marcas = await prisma.digitalizacionComision.findMany({ where: { workspaceId, createdAt: { gte: desde } }, select: { ledgerEntryId: true } });
  const asientos = marcas.length
    ? await prisma.workspaceFeeLedgerEntry.findMany({
        where: { workspaceId, kind: "DEVENGADO", id: { in: marcas.map((m) => m.ledgerEntryId) } },
        select: { amountArs: true },
      })
    : [];
  return {
    devengadoMesMinor: asientos.reduce((s, a) => s + decimalArsToMinor(a.amountArs), 0),
    saldoPendienteMinor: await pendingFeeDebtMinor(workspaceId),
  };
}
