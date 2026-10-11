import "server-only";
import { prisma } from "@repo/db";
import { PENDING_HOLD_HOURS, arMinutesOfDay } from "@repo/muestras";
import { certificarCopia, conciliarDesdeOrden, conciliarPedido } from "./conciliar";
import { buscarOrdenPorReferencia } from "./mp";
import { borrarPrivado, listarPrivado } from "./r2-privado";

/**
 * El barrido de la venta (etapa 8, D22, D29), cada 10 minutos desde `/api/cron/ventas`:
 * (0) busca en Mercado Pago, por su referencia, los pedidos que quedaron sin saber si la Order se
 * creó (no depende del aviso de CLF); (1) vence las reservas sin Order; (2) pregunta a Mercado Pago
 * por los pedidos pendientes con Order (los de más de 72 horas quedan con una alerta); (3) una vez
 * por día, entre las 4:00 y las 4:10 de Argentina, repasa los pagados de los últimos 60 días buscando
 * devoluciones y contracargos hechos fuera, y limpia las subidas de originales sin confirmar; (4)
 * reintenta los certificados de las copias emitidas que todavía no lo tienen.
 *
 * Cada pedido va en su propio intento: si uno falla, queda una alerta en su historial y se sigue con
 * el resto. A los 45 segundos corta y devuelve lo hecho (la función tiene 60): lo que falta, lo toma
 * el próximo barrido. Devuelve sólo cantidades: nada de datos personales.
 */
export type ResumenDelBarrido = {
  buscados: number; encontrados: number; vencidos: number; consultados: number; alertas: number; repasados: number; certificados: number;
  huerfanos: number; errores: number; cortado: boolean;
};

const HORA = 60 * 60_000;
const DIA = 24 * HORA;
const LOTE_VENCER = 200;
const LOTE_PENDIENTES = 50;
const LOTE_PAGADOS = 100;
const SIN_SABER = new Set(["CREATING", "UNKNOWN_CREATE"]);
const LOTE_SIN_SABER = 20;
/** Un pedido "creando" más nuevo que esto puede tener la creación en curso: no se busca todavía. */
const CREANDO_GRACIA_MS = 2 * 60_000;
const TIEMPO_MAX_MS = 45_000;
const ALERTA_ERROR = "ALERT_SWEEP_ERROR";
const ALERTA_PAGO_SIN_ORDEN = "ALERT_UNKNOWN_CREATE: hay un pago con esta referencia y no encontramos su Order: conciliar a mano";

/** Una alerta en el historial del pedido, una sola vez por texto. */
async function alertarUnaVez(orderId: string, detalle: string): Promise<boolean> {
  const ya = await prisma.culturalSaleEvent.findFirst({ where: { orderId, detail: detalle }, select: { id: true } });
  if (ya) return false;
  await prisma.culturalSaleEvent.create({ data: { orderId, source: "SWEEP", detail: detalle } });
  return true;
}

type Reloj = () => number;

/** Recorre una lista con el corte por tiempo y un intento por elemento. */
async function cadaUno<T>(
  lista: readonly T[],
  ctx: { reloj: Reloj; inicio: number; r: ResumenDelBarrido },
  idDe: (x: T) => string | null,
  hacer: (x: T) => Promise<void>,
): Promise<void> {
  for (const x of lista) {
    if (ctx.reloj() - ctx.inicio > TIEMPO_MAX_MS) {
      ctx.r.cortado = true;
      return;
    }
    try {
      await hacer(x);
    } catch (error) {
      ctx.r.errores++;
      const nombre = (error as { name?: unknown } | null)?.name;
      console.error("[muestras][ventas] barrido:", { name: typeof nombre === "string" ? nombre : "Error" });
      const id = idDe(x);
      if (id) await alertarUnaVez(id, `${ALERTA_ERROR}: el barrido falló con este pedido (${typeof nombre === "string" ? nombre : "Error"})`).catch(() => undefined);
    }
  }
}

async function vencerSinOrden(ahora: Date, ctx: { reloj: Reloj; inicio: number; r: ResumenDelBarrido }): Promise<void> {
  const viejos = await prisma.culturalSaleOrder.findMany({
    where: { status: "PENDING_PAYMENT", providerOrderId: null, holdExpiresAt: { lt: ahora } },
    select: { id: true, copyId: true, providerStatus: true },
    orderBy: { holdExpiresAt: "asc" },
    take: LOTE_VENCER,
  });
  await cadaUno(viejos, ctx, (p) => p.id, async (p) => {
    const hecho = await prisma.$transaction(async (tx) => {
      const { count } = await tx.culturalSaleOrder.updateMany({
        where: { id: p.id, status: "PENDING_PAYMENT", providerOrderId: null },
        data: { status: "EXPIRED", copyId: null, lastSyncedAt: ahora },
      });
      if (count === 0) return false;
      if (p.copyId) {
        await tx.culturalEditionCopy.updateMany({ where: { id: p.copyId, orderId: p.id, status: "RESERVED" }, data: { status: "RELEASED", reservedUntil: null, orderId: null } });
      }
      // Si el pago se cayó a mitad de camino, puede haber una Order: el paso (0) de los próximos
      // barridos la busca por su referencia y, si se pagó, la conciliación busca otro número (D23).
      const detalle = SIN_SABER.has(p.providerStatus ?? "")
        ? "ALERT_UNKNOWN_CREATE: la reserva venció sin saber si Mercado Pago creó la Order"
        : "Reserva vencida sin pago";
      await tx.culturalSaleEvent.create({ data: { orderId: p.id, source: "SWEEP", fromStatus: "PENDING_PAYMENT", toStatus: "EXPIRED", detail: detalle } });
      return true;
    });
    if (hecho) ctx.r.vencidos++;
  });
}

/**
 * (0) Los pedidos que quedaron sin saber si Mercado Pago creó la Order (la creación falló sin
 * respuesta): se buscan por su referencia. Si aparece la Order, se concilia (pagada → copia, o pago
 * tardío); si hay un pago sin Order, queda la alerta "conciliar a mano"; si no hay nada, se vuelve a
 * buscar en el próximo barrido (hasta 7 días).
 */
async function buscarSinSaber(ahora: Date, ctx: { reloj: Reloj; inicio: number; r: ResumenDelBarrido }): Promise<void> {
  const dudosos = await prisma.culturalSaleOrder.findMany({
    where: {
      providerOrderId: null,
      providerStatus: { in: [...SIN_SABER] },
      status: { in: ["PENDING_PAYMENT", "EXPIRED"] },
      createdAt: { gte: new Date(ahora.getTime() - 7 * DIA) },
    },
    select: { id: true, externalReference: true, providerStatus: true, createdAt: true },
    orderBy: { createdAt: "asc" },
    take: LOTE_SIN_SABER,
  });
  const listos = dudosos.filter((p) => p.providerStatus !== "CREATING" || ahora.getTime() - p.createdAt.getTime() > CREANDO_GRACIA_MS);
  await cadaUno(listos, ctx, (p) => p.id, async (p) => {
    ctx.r.buscados++;
    const b = await buscarOrdenPorReferencia(p.externalReference);
    if (!b) return;
    if ("orden" in b) {
      await conciliarDesdeOrden(b.orden, "SWEEP", ahora);
      ctx.r.encontrados++;
    } else if ("pagoSinOrden" in b) {
      if (await alertarUnaVez(p.id, ALERTA_PAGO_SIN_ORDEN)) ctx.r.alertas++;
    }
  });
}

/**
 * Subidas de originales que nunca se confirmaron (o que quedaron reemplazadas): más de un día en
 * `originales/` sin que ningún `CulturalSaleFile` las use. Se borran de a 200 por día.
 */
async function limpiarOriginalesHuerfanos(ahora: Date): Promise<number> {
  const viejos = (await listarPrivado("originales/", 1000)).filter((o) => o.modificado && ahora.getTime() - o.modificado.getTime() > DIA).slice(0, 200);
  if (!viejos.length) return 0;
  const usados = new Set(
    (await prisma.culturalSaleFile.findMany({ where: { storageKey: { in: viejos.map((o) => o.clave) } }, select: { storageKey: true } })).map((f) => f.storageKey),
  );
  let borrados = 0;
  for (const o of viejos) {
    if (usados.has(o.clave)) continue;
    await borrarPrivado(o.clave).then(() => borrados++, () => undefined);
  }
  return borrados;
}

const ALERTA_PENDIENTE = "ALERT_STALE_PENDING: Mercado Pago no confirma el pago hace más de 72 horas";

export async function barrerVentas(ahora: Date = new Date(), { reloj = Date.now }: { reloj?: Reloj } = {}): Promise<ResumenDelBarrido> {
  const r: ResumenDelBarrido = {
    buscados: 0, encontrados: 0, vencidos: 0, consultados: 0, alertas: 0, repasados: 0, certificados: 0, huerfanos: 0, errores: 0, cortado: false,
  };
  const ctx = { reloj, inicio: reloj(), r };

  await buscarSinSaber(ahora, ctx);
  await vencerSinOrden(ahora, ctx);

  const pendientes = await prisma.culturalSaleOrder.findMany({
    where: { status: "PENDING_PAYMENT", providerOrderId: { not: null } },
    select: { id: true, providerOrderId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
    take: LOTE_PENDIENTES,
  });
  await cadaUno(pendientes, ctx, (p) => p.id, async (p) => {
    r.consultados++;
    const c = await conciliarPedido({ providerOrderId: p.providerOrderId! }, "SWEEP");
    const sigue = (c?.estado ?? "PENDING_PAYMENT") === "PENDING_PAYMENT";
    if (sigue && ahora.getTime() - p.createdAt.getTime() > PENDING_HOLD_HOURS * HORA) {
      if (await alertarUnaVez(p.id, ALERTA_PENDIENTE)) r.alertas++;
    }
  });

  const minuto = arMinutesOfDay(ahora);
  const repaso = minuto >= 4 * 60 && minuto < 4 * 60 + 10;
  if (repaso) {
    const pagados = await prisma.culturalSaleOrder.findMany({
      where: { status: { in: ["PAID", "PAID_NO_COPY"] }, providerOrderId: { not: null }, paidAt: { gte: new Date(ahora.getTime() - 60 * DIA) } },
      select: { id: true, providerOrderId: true },
      orderBy: { lastSyncedAt: "asc" },
      take: LOTE_PAGADOS,
    });
    await cadaUno(pagados, ctx, (p) => p.id, async (p) => {
      await conciliarPedido({ providerOrderId: p.providerOrderId! }, "SWEEP");
      r.repasados++;
    });
    if (!r.cortado) r.huerfanos = await limpiarOriginalesHuerfanos(ahora).catch(() => 0);
  }

  const sinCertificado = r.cortado
    ? []
    : await prisma.culturalEditionCopy.findMany({ where: { status: "ISSUED", certificateCode: null }, select: { id: true, orderId: true }, take: LOTE_PENDIENTES });
  await cadaUno(sinCertificado, ctx, (c) => c.orderId, async (c) => {
    if ((await certificarCopia(c.id, ahora)) === "OK") r.certificados++;
  });

  return r;
}
