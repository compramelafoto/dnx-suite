import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { decimalArsToMinor } from "@/lib/membership/money";
import { pendingFeeDebtMinor, recordEntryReturningId } from "@/lib/platform-fee/ledger";
import { getPlatformFeeBpsStrict } from "@/lib/platform-fee/store";
import {
  COMISION_DIGITALIZACION_DESDE,
  cobrosQueDevengan,
  descargaDeDeuda,
  inicioDelMesArgentino,
  notaDevengado,
  notaReverso,
  notaReversoRetencion,
  notaRetenido,
  reversoAcotado,
  type Retencion,
} from "../comision";
import { DIGITALIZACION_MODULE_KEY } from "../constants";

/**
 * La comisión de plataforma sobre los pedidos de digitalización de otros negocios (spec 2026-10-22,
 * F1), del lado del servidor. Mismo libro que socios y reservas (`WorkspaceFeeLedgerEntry`).
 *
 * - **Qué pedido:** el que tiene `DigitalizacionEntrega` o algún trabajo con grabaciones (no descartadas).
 * - **Desde cuándo:** sólo los cobros con `paidAt` desde `COMISION_DIGITALIZACION_DESDE` (23/10, 00:00 de
 *   Argentina).
 * - **Tasa estricta:** si la base no deja leer la tasa, esa corrida no hace nada (ni devenga ni retiene):
 *   lo concilia el cron después. Nunca se asienta con una tasa supuesta.
 * - **Cobro manual**, o de Mercado Pago sin retención (abierto antes de la entrega): DEVENGADO por la
 *   comisión entera, después del commit del cobro y sin lanzar. Al crearse la entrega se devengan los
 *   cobros que el pedido ya tenía (la seña se cobra antes de grabar).
 * - **Mercado Pago con retención** (sólo el `application_fee` que informa MP): en la MISMA transacción
 *   del cobro, un asiento RETENIDO por la parte que canceló deuda (retenido − propio, acotado a la deuda
 *   de ese momento). Puede ser de 0 pesos: es la marca de que el cobro ya pagó su comisión.
 * - **Marca:** cada cobro con comisión tiene su `DigitalizacionComision` (`cobroId` único): así nunca
 *   se devenga dos veces, ni entre el cobro, la entrega y los crons a la vez.
 * - **Anular un cobro** con un DEVENGADO: asiento REVERSADO negativo, acotado a la deuda pendiente del
 *   negocio (el saldo nunca queda negativo; lo que no se pudo revertir queda en la nota), y la marca pasa
 *   a apuntar al reverso: el cobro no se vuelve a devengar ni a revertir.
 * - **Devolución o contracargo** de un pago con RETENIDO distinto de 0: REVERSADO positivo por ese monto
 *   (la deuda que había cancelado vuelve a quedar pendiente), como en `membership/credit-payment.ts`; la
 *   marca pasa al reverso. Anular el cobro en FOTOFFICE, en cambio, no toca la retención: no prueba que
 *   Mercado Pago haya devuelto nada.
 * - **0 bps** (DNX, que es la plataforma): nada en ningún camino.
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

/**
 * La tasa de digitalización del negocio (0 = DNX: no hay comisión). **null si la base falló**: quien
 * llama no hace nada en esa corrida (a diferencia de `getPlatformFeeBps`, que supone el 5 %).
 */
export async function tasaDeDigitalizacion(workspaceId: string): Promise<number | null> {
  try {
    return await getPlatformFeeBpsStrict(workspaceId, DIGITALIZACION_MODULE_KEY);
  } catch (e) {
    console.error("[digitalizacion][comision] no se pudo leer la tasa: no se asienta nada en esta corrida", { codigo: codigo(e) });
    return null;
  }
}

type CobroLeido = { id: string; pedidoId: string; amountArs: { toString(): string }; voidedAt: Date | null; receiptNumber: string; paidAt: Date };
const SELECT_COBRO = { id: true, pedidoId: true, amountArs: true, voidedAt: true, receiptNumber: true, paidAt: true } as const;

/** Devenga los cobros pendientes de un negocio (marca + asiento juntos). Devuelve cuántos devengó. */
async function devengarCobros(workspaceId: string, bps: number, cobros: readonly CobroLeido[], numeros: ReadonlyMap<string, string>): Promise<number> {
  if (bps <= 0 || cobros.length === 0) return 0;
  const marcas = await prisma.digitalizacionComision.findMany({ where: { cobroId: { in: cobros.map((c) => c.id) } }, select: { cobroId: true } });
  const pendientes = cobrosQueDevengan(
    cobros.map((c) => ({ id: c.id, voidedAt: c.voidedAt, amountMinor: decimalArsToMinor(c.amountArs), paidAt: c.paidAt })),
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
 * Devenga la comisión de los cobros vigentes del pedido (desde la fecha de corte) que todavía no la
 * tienen. Lo llaman el cobro (después del commit) y la creación de la entrega. Idempotente. Nunca lanza.
 */
export async function devengarComisionesDelPedido(workspaceId: string, pedidoId: string): Promise<number> {
  try {
    if (!(await esPedidoDeDigitalizacion(workspaceId, pedidoId))) return 0;
    const bps = await tasaDeDigitalizacion(workspaceId);
    if (bps === null || bps <= 0) return 0;
    const pedido = await prisma.fotofficePedido.findFirst({ where: { id: pedidoId, workspaceId }, select: { id: true, number: true } });
    if (!pedido) return 0;
    const cobros = await prisma.fotofficeCobro.findMany({
      where: { workspaceId, pedidoId, voidedAt: null, paidAt: { gte: COMISION_DIGITALIZACION_DESDE } },
      select: SELECT_COBRO,
    });
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
  input: { workspaceId: string; pedidoId: string; cobroId: string; reciboNumero: string; retencion: Retencion; bps: number | null },
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
 * Asienta un reverso y mueve la marca del cobro a ese reverso, en una transacción y con la condición
 * de que la marca todavía apunte al asiento original: dos corridas a la vez no revierten dos veces.
 * `monto` recibe la deuda del negocio leída adentro de la transacción y devuelve el asiento firmado.
 */
async function moverMarcaAlReverso(
  workspaceId: string,
  cobroId: string,
  asientoId: string,
  armar: (deudaMinor: number) => { signedAmountMinor: number; note: string },
): Promise<boolean> {
  try {
    await prisma.$transaction(async (tx) => {
      const a = armar(await pendingFeeDebtMinor(workspaceId, tx));
      const reverso = await recordEntryReturningId(tx, { workspaceId, kind: "REVERSADO", ...a });
      const r = await tx.digitalizacionComision.updateMany({ where: { cobroId, workspaceId, ledgerEntryId: asientoId }, data: { ledgerEntryId: reverso } });
      if (r.count !== 1) throw new YaRevertida();
    });
    return true;
  } catch (e) {
    if (e instanceof YaRevertida) return false;
    throw e;
  }
}

/** La marca del cobro y su asiento, si son del negocio. */
async function marcaYAsiento(workspaceId: string, cobroId: string) {
  const marca = await prisma.digitalizacionComision.findFirst({ where: { cobroId, workspaceId }, select: { ledgerEntryId: true } });
  if (!marca) return null;
  const asiento = await prisma.workspaceFeeLedgerEntry.findFirst({ where: { id: marca.ledgerEntryId, workspaceId }, select: { id: true, kind: true, amountArs: true } });
  if (!asiento) return null;
  const cobro = await prisma.fotofficeCobro.findFirst({ where: { id: cobroId, workspaceId }, select: { pedidoId: true, receiptNumber: true, voidedAt: true } });
  if (!cobro) return null;
  const pedido = await prisma.fotofficePedido.findFirst({ where: { id: cobro.pedidoId, workspaceId }, select: { number: true } });
  return { asiento, cobro, pedidoNumero: pedido?.number ?? "sin número" };
}

/**
 * Un cobro anulado que había devengado comisión: asiento REVERSADO negativo por el devengado, acotado a
 * la deuda pendiente del negocio en ese momento (si la deuda ya se había cobrado reteniéndola, el saldo
 * no puede quedar a favor; lo que no se revirtió queda en la nota). La marca pasa al reverso (aunque sea
 * de 0 pesos). No toca las retenciones de Mercado Pago. Nunca lanza.
 */
export async function revertirComisionDelCobro(workspaceId: string, cobroId: string): Promise<boolean> {
  try {
    const m = await marcaYAsiento(workspaceId, cobroId);
    if (!m || m.asiento.kind !== "DEVENGADO" || !m.cobro.voidedAt) return false;
    const devengado = decimalArsToMinor(m.asiento.amountArs);
    if (devengado <= 0) return false;
    return await moverMarcaAlReverso(workspaceId, cobroId, m.asiento.id, (deuda) => {
      const r = reversoAcotado(devengado, deuda);
      return { signedAmountMinor: -r.revertidoMinor, note: notaReverso({ pedidoNumero: m.pedidoNumero, recibo: m.cobro.receiptNumber, ...r }) };
    });
  } catch (e) {
    console.error("[digitalizacion][comision] no se pudo revertir la comisión de un cobro anulado", { codigo: codigo(e) });
    return false;
  }
}

/**
 * Mercado Pago devolvió (o le hicieron un contracargo) un pago cuya retención canceló deuda: REVERSADO
 * positivo por lo que había cancelado (la deuda vuelve a quedar pendiente), igual que
 * `membership/credit-payment.ts`. Sólo si la marca apunta a un RETENIDO distinto de 0; la marca pasa
 * al reverso, así un aviso repetido no lo duplica. Nunca lanza.
 */
export async function revertirRetencionDelCobro(workspaceId: string, cobroId: string, estado: "refunded" | "charged_back"): Promise<boolean> {
  try {
    const m = await marcaYAsiento(workspaceId, cobroId);
    if (!m || m.asiento.kind !== "RETENIDO") return false;
    const cancelado = Math.abs(decimalArsToMinor(m.asiento.amountArs));
    if (cancelado <= 0) return false;
    return await moverMarcaAlReverso(workspaceId, cobroId, m.asiento.id, () => ({
      signedAmountMinor: cancelado,
      note: notaReversoRetencion({ pedidoNumero: m.pedidoNumero, recibo: m.cobro.receiptNumber, montoMinor: cancelado, estado: estado === "refunded" ? "devuelto" : "contracargo" }),
    }));
  } catch (e) {
    console.error("[digitalizacion][comision] no se pudo revertir la retención de un pago devuelto", { codigo: codigo(e) });
    return false;
  }
}

// --- Conciliación (crons) ---------------------------------------------------------------------

export type ReporteComisiones = { devengadas: number; revertidas: number };

/**
 * Cuánto mira para atrás la conciliación: cobros creados o anulados, y entregas creadas, en esta
 * ventana (y siempre desde la fecha de corte). Lo de más atrás ya lo tuvo que haber visto una corrida
 * anterior: así no se lee todo el historial cada 15 minutos.
 */
export const DIAS_CONCILIACION = 90;
const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Los cobros a mirar, por negocio: los de pedidos de digitalización pagados desde la fecha de corte,
 * creados o anulados dentro de la ventana, más todos los (desde el corte) de los pedidos cuya entrega
 * nació dentro de la ventana (la seña se cobra mucho antes de que nazca la entrega).
 */
async function cobrosParaConciliar(ahora: Date): Promise<Map<string, CobroLeido[]>> {
  const ventana = new Date(ahora.getTime() - DIAS_CONCILIACION * DIA_MS);
  const desdeCorte = { paidAt: { gte: COMISION_DIGITALIZACION_DESDE } };
  const [recientes, entregasNuevas] = await Promise.all([
    prisma.fotofficeCobro.findMany({ where: { ...desdeCorte, OR: [{ createdAt: { gte: ventana } }, { voidedAt: { gte: ventana } }] }, select: { pedidoId: true } }),
    prisma.digitalizacionEntrega.findMany({ where: { createdAt: { gte: ventana } }, select: { pedidoId: true } }),
  ]);
  const candidatos = [...new Set([...recientes.map((c) => c.pedidoId), ...entregasNuevas.map((e) => e.pedidoId)])];
  if (candidatos.length === 0) return new Map();
  // Cuáles son de digitalización: con entrega o con grabaciones no descartadas.
  const [conEntrega, grabaciones] = await Promise.all([
    prisma.digitalizacionEntrega.findMany({ where: { pedidoId: { in: candidatos } }, select: { pedidoId: true } }),
    prisma.digitalizacionGrabacion.findMany({
      where: { estado: { not: "DESCARTADA" }, proyecto: { pedidoId: { in: candidatos } } },
      select: { proyectoId: true },
    }),
  ]);
  const proyectoIds = [...new Set(grabaciones.map((g) => g.proyectoId).filter((id): id is string => id !== null))];
  const conGrabacion = proyectoIds.length
    ? await prisma.fotofficeProyecto.findMany({ where: { id: { in: proyectoIds } }, select: { pedidoId: true } })
    : [];
  const deDigitalizacion = [...new Set([...conEntrega.map((e) => e.pedidoId), ...conGrabacion.map((p) => p.pedidoId).filter((id): id is string => id !== null)])];
  if (deDigitalizacion.length === 0) return new Map();
  const cobros = await prisma.fotofficeCobro.findMany({
    where: { ...desdeCorte, pedidoId: { in: deDigitalizacion } },
    select: { ...SELECT_COBRO, workspaceId: true },
  });
  const porNegocio = new Map<string, CobroLeido[]>();
  for (const { workspaceId, ...c } of cobros) {
    if (!porNegocio.has(workspaceId)) porNegocio.set(workspaceId, []);
    porNegocio.get(workspaceId)!.push(c);
  }
  return porNegocio;
}

/**
 * Lo que el camino rápido no llegó a hacer (corre después del commit y sin reintento):
 * - revierte los devengados de cobros anulados (aunque la tasa de hoy sea 0 o no se pueda leer);
 * - devenga los cobros vigentes sin marca (los de Mercado Pago con retención siempre la tienen: nace
 *   en la transacción del cobro). Si la tasa no se puede leer, ese negocio queda para la próxima.
 * Nunca lanza; devuelve contadores.
 */
export async function conciliarComisiones(deps: { ahora?: () => Date } = {}): Promise<ReporteComisiones> {
  const ahora = (deps.ahora ?? (() => new Date()))();
  const reporte: ReporteComisiones = { devengadas: 0, revertidas: 0 };
  let porNegocio: Map<string, CobroLeido[]>;
  try {
    porNegocio = await cobrosParaConciliar(ahora);
  } catch (e) {
    console.error("[digitalizacion][comision] falló la búsqueda de cobros para conciliar", { codigo: codigo(e) });
    return reporte;
  }
  for (const [workspaceId, cobros] of porNegocio) {
    try {
      const anulados = cobros.filter((c) => c.voidedAt !== null).map((c) => c.id);
      if (anulados.length) {
        const marcas = await prisma.digitalizacionComision.findMany({ where: { workspaceId, cobroId: { in: anulados } }, select: { cobroId: true, ledgerEntryId: true } });
        const devengados = marcas.length
          ? await prisma.workspaceFeeLedgerEntry.findMany({ where: { workspaceId, kind: "DEVENGADO", id: { in: marcas.map((m) => m.ledgerEntryId) } }, select: { id: true } })
          : [];
        const conDevengado = new Set(devengados.map((d) => d.id));
        for (const m of marcas) {
          if (conDevengado.has(m.ledgerEntryId) && (await revertirComisionDelCobro(workspaceId, m.cobroId))) reporte.revertidas++;
        }
      }
      const bps = await tasaDeDigitalizacion(workspaceId);
      if (bps === null || bps <= 0) continue;
      const pedidoIds = [...new Set(cobros.map((c) => c.pedidoId))];
      const numeros = await prisma.fotofficePedido.findMany({ where: { workspaceId, id: { in: pedidoIds } }, select: { id: true, number: true } });
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
 * digitalización y la deuda pendiente del negocio con la plataforma (todo el libro). null con 0 bps
 * o si la tasa no se pudo leer: DNX no ve nada. Un devengado revertido ya no cuenta (su marca apunta
 * al reverso).
 */
export async function resumenDeComision(workspaceId: string, ahora: Date = new Date()): Promise<ResumenComision | null> {
  const bps = await tasaDeDigitalizacion(workspaceId);
  if (bps === null || bps <= 0) return null;
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
