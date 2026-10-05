import "server-only";
import { prisma, type Prisma, type StoreOrderStatus } from "@repo/db";
import { voidSale } from "@/lib/sales/void-sale";
import {
  STORE_NOTE_AMOUNT_MISMATCH,
  STORE_NOTE_CREDIT_FAILURE_PREFIX,
  STORE_NOTE_DUPLICATE_PREFIX,
  STORE_NOTE_REGRET,
} from "./constants";
import { finalizePaidOrder, lockAndCheckOrderStock, SELECT_PEDIDO_A_ACREDITAR } from "./credit-payment";
import { sendOrderPaidEmail, sendOrderReadyEmail, sendOrderShippedEmail } from "./emails";
import { normalizeTrackingNumber } from "./shipping/tracking";
import { canTransition } from "./transitions";

/**
 * Lo que hace el personal con los pedidos online desde el panel (`/ventas/tienda`): prepararlos,
 * despacharlos (los que van con envío), entregarlos, cancelarlos y reponer el stock de uno que se
 * pagó sin stock.
 *
 * Mismas reglas que la acreditación (`credit-payment.ts`):
 * - El pedido se bloquea (`FOR UPDATE`) ANTES de leer su estado, y el stock después. Dos
 *   personas que tocan el mismo pedido a la vez se ordenan acá; la segunda ve lo que hizo la
 *   primera y, si su cambio ya no vale, recibe un error en vez de pisarlo.
 * - Los correos salen DESPUÉS de confirmar la transacción.
 * - Cancelar un pedido pagado anula su venta (`voidSale`) en la misma transacción. El id del pago
 *   de Mercado Pago no se borra nunca: es la constancia de que la plata entró y hay que devolverla.
 */

type Tx = Prisma.TransactionClient;

export type OrderAdminResult = { ok: true } | { ok: false; error: string };

const NOTA_MAX = 500;
const ESTADOS: readonly StoreOrderStatus[] = [
  "PENDING_PAYMENT",
  "PAID",
  "READY",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "EXPIRED",
  "PAID_NO_STOCK",
];
/** Estados en los que la plata ya entró: cancelar exige explicar por qué (y devolverla). */
const CON_PLATA: readonly StoreOrderStatus[] = ["PAID", "READY", "SHIPPED", "PAID_NO_STOCK"];
/** Estados con venta registrada: cancelar la anula. */
const CON_VENTA: readonly StoreOrderStatus[] = ["PAID", "READY", "SHIPPED"];

// ── Reglas puras ────────────────────────────────────────────────────────────

/** Lo que deja `markOrderReviewed`. Sólo cuenta si lo escribió una persona. */
export const STORE_NOTE_REVIEWED_PREFIX = "Revisado:";

/**
 * Las constancias que convierten un pedido en "problema" hasta que una persona lo marque como
 * revisado. Una sola lista para la regla pura (`isProblemOrder`) y para la consulta que junta
 * los candidatos (`problemOrderIds`): si se agregara una nota sólo en un lado, el pedido nunca
 * llegaría a la pestaña o nunca saldría de ella.
 *
 * El arrepentimiento (`STORE_NOTE_REGRET`) está acá porque la ley da un plazo para responderlo:
 * si sólo quedara en el historial del pedido, nadie se enteraría desde el panel.
 */
const PREFIJOS_DE_PROBLEMA = [
  STORE_NOTE_DUPLICATE_PREFIX,
  STORE_NOTE_CREDIT_FAILURE_PREFIX,
  STORE_NOTE_REGRET,
] as const;

function esNotaDeProblema(note: string | null): boolean {
  const n = note ?? "";
  return PREFIJOS_DE_PROBLEMA.some((prefijo) => n.startsWith(prefijo));
}

/**
 * ¿Hay que mirar este pedido? Pagado sin stock (hasta que se resuelva cambiando de estado), o
 * con una constancia —un pago duplicado, un pago aprobado que no se pudo acreditar, o un pedido
 * de arrepentimiento del comprador— que nadie marcó como revisada DESPUÉS. Prepararlo o entregarlo no la resuelve: el
 * segundo pago sigue sin devolverse. `events` va en orden cronológico.
 */
export function isProblemOrder(input: {
  status: StoreOrderStatus;
  events: readonly { note: string | null; actorUserId: number | null }[];
}): boolean {
  if (input.status === "PAID_NO_STOCK") return true;
  let pendiente = false;
  for (const e of input.events) {
    if (esNotaDeProblema(e.note)) pendiente = true;
    else if (e.actorUserId !== null && (e.note ?? "").startsWith(STORE_NOTE_REVIEWED_PREFIX)) pendiente = false;
  }
  return pendiente;
}

/** ¿El pedido quedó sin stock porque se cobró un monto distinto? Entonces sólo se puede devolver. */
export function isAmountMismatchNote(note: string | null | undefined): boolean {
  return (note ?? "").startsWith(STORE_NOTE_AMOUNT_MISMATCH.split(":")[0]!);
}

/** Los estados a los que el personal puede llevar el pedido, en el orden de los botones. */
export function staffTargets(
  from: StoreOrderStatus,
  opts: { amountMismatch: boolean; deliveryMethod: string },
): StoreOrderStatus[] {
  return ESTADOS.filter((to) => canTransition(from, to, "staff", opts.deliveryMethod)).filter(
    (to) => !(from === "PAID_NO_STOCK" && to === "PAID" && opts.amountMismatch),
  );
}

export function cancelNeedsNote(from: StoreOrderStatus): boolean {
  return CON_PLATA.includes(from);
}

function limpiarNota(note: string | null | undefined): string | null {
  const n = (note ?? "").trim();
  return n === "" ? null : n.slice(0, NOTA_MAX);
}

// ── Cambiar el estado ───────────────────────────────────────────────────────

/** Corta la transacción con un mensaje para la persona: hace ROLLBACK de lo que hubiera. */
class Rechazo extends Error {
  constructor(readonly mensaje: string) {
    super(mensaje);
  }
}

const SELECT_PEDIDO_PANEL = {
  ...SELECT_PEDIDO_A_ACREDITAR,
  saleId: true,
  paidAt: true,
  deliveryMethod: true,
} satisfies Prisma.StoreOrderSelect;

async function bloquearYLeer(tx: Tx, workspaceId: string, orderId: string) {
  await tx.$queryRaw`SELECT "id" FROM "StoreOrder" WHERE "id" = ${orderId} AND "workspaceId" = ${workspaceId} FOR UPDATE`;
  const order = await tx.storeOrder.findFirst({ where: { id: orderId, workspaceId }, select: SELECT_PEDIDO_PANEL });
  if (!order) throw new Rechazo("Ese pedido no existe.");
  return order;
}

/** ¿Este pedido quedó sin stock por un cobro de monto distinto? Mira cómo ENTRÓ a ese estado. */
async function entroPorMontoDistinto(tx: Tx, orderId: string): Promise<boolean> {
  const evento = await tx.storeOrderEvent.findFirst({
    where: {
      orderId,
      toStatus: "PAID_NO_STOCK",
      OR: [{ fromStatus: null }, { fromStatus: { not: "PAID_NO_STOCK" } }],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { note: true },
  });
  return isAmountMismatchNote(evento?.note);
}

export async function changeOrderStatus(input: {
  workspaceId: string;
  orderId: string;
  to: StoreOrderStatus;
  userId: number;
  note: string | null;
  /** Sólo al despachar (`to: "SHIPPED"`). Opcional. */
  trackingNumber?: string | null;
}): Promise<OrderAdminResult> {
  const nota = limpiarNota(input.note);
  let seguimiento: string | null = null;
  if (input.to === "SHIPPED") {
    const t = normalizeTrackingNumber(input.trackingNumber);
    if (!t.ok) return { ok: false, error: t.error };
    seguimiento = t.value;
  }
  let aviso: "listo" | "pagado" | "despachado" | null = null;

  try {
    await prisma.$transaction(
      async (tx) => {
        const order = await bloquearYLeer(tx, input.workspaceId, input.orderId);
        const from = order.status;
        if (!canTransition(from, input.to, "staff", order.deliveryMethod)) {
          throw new Rechazo("Ese cambio ya no se puede hacer: el pedido cambió de estado. Recargá la página.");
        }
        const ahora = new Date();
        const donde = { id: order.id, workspaceId: input.workspaceId };
        const evento = (note: string | null) =>
          tx.storeOrderEvent.create({
            data: { orderId: order.id, fromStatus: from, toStatus: input.to, actorUserId: input.userId, note },
          });

        switch (input.to) {
          case "READY":
            await tx.storeOrder.updateMany({ where: donde, data: { status: "READY", readyAt: ahora } });
            await evento(nota);
            aviso = "listo";
            return;

          case "SHIPPED": {
            // Sólo llega acá un pedido con envío y pagado (lo garantiza `canTransition`).
            await tx.storeOrder.updateMany({
              where: donde,
              data: { status: "SHIPPED", shippedAt: ahora, trackingNumber: seguimiento },
            });
            const constancia = seguimiento ? `Despachado — seguimiento ${seguimiento}` : "Despachado";
            await evento(nota ? `${constancia} · ${nota}` : constancia);
            aviso = "despachado";
            return;
          }

          case "DELIVERED":
            await tx.storeOrder.updateMany({ where: donde, data: { status: "DELIVERED", deliveredAt: ahora } });
            await evento(nota);
            return;

          case "CANCELLED": {
            if (cancelNeedsNote(from) && !nota) {
              throw new Rechazo("Escribí por qué se cancela el pedido.");
            }
            if (CON_VENTA.includes(from) && order.saleId) {
              // Una venta ya anulada (de antes de que el historial lo prohibiera) no frena la
              // cancelación: la plata y el stock ya volvieron por ese camino.
              const venta = await tx.sale.findFirst({
                where: { id: order.saleId, workspaceId: input.workspaceId },
                select: { status: true },
              });
              if (venta && venta.status !== "ANULADA") {
                const anulada = await voidSale(tx, {
                  workspaceId: input.workspaceId,
                  saleId: order.saleId,
                  reason: `Pedido online #${order.orderNumber} cancelado: ${nota ?? ""}`,
                  userId: input.userId,
                  fromStoreOrder: true,
                });
                if (!anulada.ok) throw new Rechazo(anulada.error);
              }
            }
            // Sin tocar `mpPaymentId`: el pago existió y hay que devolverlo.
            await tx.storeOrder.updateMany({
              where: donde,
              data: { status: "CANCELLED", cancelledAt: ahora, holdExpiresAt: null },
            });
            await evento(nota);
            return;
          }

          case "PAID": {
            // Sólo llega acá desde PAID_NO_STOCK (lo garantiza `canTransition`).
            if (await entroPorMontoDistinto(tx, order.id)) {
              throw new Rechazo(
                "Este pedido se cobró por un monto distinto al total: no se puede dar por pagado. Cancelalo y devolvé el dinero desde Mercado Pago.",
              );
            }
            const alcanza = await lockAndCheckOrderStock(tx, order);
            if (!alcanza) throw new Rechazo("Todavía no hay stock suficiente.");
            await finalizePaidOrder(tx, order, order.paidAt ?? ahora, {
              actorUserId: input.userId,
              ...(nota ? { note: `Stock repuesto: ${nota}` } : {}),
            });
            aviso = "pagado";
            return;
          }

          default:
            throw new Rechazo("Ese cambio no se puede hacer desde el panel.");
        }
      },
      { isolationLevel: "ReadCommitted" },
    );
  } catch (error) {
    if (error instanceof Rechazo) return { ok: false, error: error.mensaje };
    console.error("[fotoffice][tienda] no se pudo cambiar el estado de un pedido", {
      storeOrderId: input.orderId,
      detalle: error instanceof Error ? error.name : "desconocido",
    });
    return { ok: false, error: "No se pudo guardar el cambio. Probá de nuevo." };
  }

  // Después de confirmar. Los envíos no lanzan (`sendAndLogEmail`).
  const ref = { workspaceId: input.workspaceId, orderId: input.orderId };
  if (aviso === "listo") await sendOrderReadyEmail(ref);
  if (aviso === "pagado") await sendOrderPaidEmail(ref);
  if (aviso === "despachado") await sendOrderShippedEmail(ref);
  return { ok: true };
}

/**
 * Deja constancia de que alguien miró un problema (un pago duplicado ya devuelto, un pago que
 * no se acreditó y ya se resolvió) sin cambiar el estado. Saca al pedido de "Problemas".
 */
export async function markOrderReviewed(input: {
  workspaceId: string;
  orderId: string;
  userId: number;
  note: string | null;
}): Promise<OrderAdminResult> {
  const nota = limpiarNota(input.note);
  if (!nota) return { ok: false, error: "Escribí qué revisaste o qué hiciste." };
  try {
    await prisma.$transaction(async (tx) => {
      const order = await bloquearYLeer(tx, input.workspaceId, input.orderId);
      await tx.storeOrderEvent.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: order.status,
          actorUserId: input.userId,
          note: `${STORE_NOTE_REVIEWED_PREFIX} ${nota}`,
        },
      });
    });
  } catch (error) {
    if (error instanceof Rechazo) return { ok: false, error: error.mensaje };
    console.error("[fotoffice][tienda] no se pudo anotar un pedido", {
      storeOrderId: input.orderId,
      detalle: error instanceof Error ? error.name : "desconocido",
    });
    return { ok: false, error: "No se pudo guardar la nota. Probá de nuevo." };
  }
  return { ok: true };
}

// ── Lecturas del panel ──────────────────────────────────────────────────────

export const STORE_ORDER_TABS = [
  "preparar",
  "despachar",
  "listos",
  "despachados",
  "entregados",
  "esperando",
  "problemas",
  "todos",
] as const;
export type StoreOrderTab = (typeof STORE_ORDER_TABS)[number];

/**
 * Qué junta cada pestaña (salvo "problemas" y "todos"). Los pagados se separan por forma de
 * entrega: "Por preparar" son los que se retiran y "Para despachar" los que van con envío. Un
 * pedido de la etapa 1 no tiene otra forma que retiro.
 */
const FILTRO_DE_PESTANA: Partial<Record<StoreOrderTab, Prisma.StoreOrderWhereInput>> = {
  preparar: { status: "PAID", deliveryMethod: { not: "SHIPPING" } },
  despachar: { status: "PAID", deliveryMethod: "SHIPPING" },
  listos: { status: "READY" },
  despachados: { status: "SHIPPED" },
  entregados: { status: "DELIVERED" },
  esperando: { status: "PENDING_PAYMENT" },
};

export function parseStoreOrderTab(raw: string | undefined): StoreOrderTab {
  return (STORE_ORDER_TABS as readonly string[]).includes(raw ?? "") ? (raw as StoreOrderTab) : "preparar";
}

/** Los pedidos con problemas (ver `isProblemOrder`). Pocos por naturaleza: se filtran acá. */
async function problemOrderIds(workspaceId: string): Promise<string[]> {
  const notaDeProblema: Prisma.StoreOrderEventWhereInput[] = PREFIJOS_DE_PROBLEMA.map((prefijo) => ({
    note: { startsWith: prefijo },
  }));
  const candidatos = await prisma.storeOrder.findMany({
    where: { workspaceId, OR: [{ status: "PAID_NO_STOCK" }, { events: { some: { OR: notaDeProblema } } }] },
    // El tope se queda con los más recientes.
    orderBy: { updatedAt: "desc" },
    take: 500,
    select: {
      id: true,
      status: true,
      // Sólo las notas que deciden: las de problema y las de "revisado".
      events: {
        where: { OR: [...notaDeProblema, { note: { startsWith: STORE_NOTE_REVIEWED_PREFIX } }] },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { note: true, actorUserId: true },
      },
    },
  });
  return candidatos.filter((c) => isProblemOrder({ status: c.status, events: c.events })).map((c) => c.id);
}

export type StoreOrderListRow = {
  id: string;
  orderNumber: number;
  createdAt: Date;
  buyerName: string;
  buyerEmail: string;
  totalArs: Prisma.Decimal;
  status: StoreOrderStatus;
  deliveryMethod: string;
  problem: boolean;
};

export async function listStoreOrders(
  workspaceId: string,
  tab: StoreOrderTab,
): Promise<{ rows: StoreOrderListRow[]; counts: Record<StoreOrderTab, number> }> {
  const [problemas, porEstado, total] = await Promise.all([
    problemOrderIds(workspaceId),
    prisma.storeOrder.groupBy({ by: ["status", "deliveryMethod"], where: { workspaceId }, _count: { _all: true } }),
    prisma.storeOrder.count({ where: { workspaceId } }),
  ]);
  const contar = (s: StoreOrderStatus, envio?: boolean) =>
    porEstado
      .filter((g) => g.status === s && (envio === undefined || (g.deliveryMethod === "SHIPPING") === envio))
      .reduce((n, g) => n + g._count._all, 0);

  const filtro = FILTRO_DE_PESTANA[tab];
  const where: Prisma.StoreOrderWhereInput =
    tab === "problemas"
      ? { workspaceId, id: { in: problemas } }
      : filtro
        ? { workspaceId, ...filtro }
        : { workspaceId };

  const filas = await prisma.storeOrder.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      orderNumber: true,
      createdAt: true,
      buyerName: true,
      buyerEmail: true,
      totalArs: true,
      status: true,
      deliveryMethod: true,
    },
  });
  const esProblema = new Set(problemas);

  return {
    rows: filas.map((f) => ({ ...f, problem: esProblema.has(f.id) })),
    counts: {
      preparar: contar("PAID", false),
      despachar: contar("PAID", true),
      listos: contar("READY"),
      despachados: contar("SHIPPED"),
      entregados: contar("DELIVERED"),
      esperando: contar("PENDING_PAYMENT"),
      problemas: problemas.length,
      todos: total,
    },
  };
}

const SELECT_DETALLE = {
  id: true,
  orderNumber: true,
  status: true,
  buyerName: true,
  buyerEmail: true,
  buyerPhone: true,
  clientId: true,
  saleId: true,
  mpPaymentId: true,
  subtotalArs: true,
  shippingArs: true,
  totalArs: true,
  deliveryMethod: true,
  shippingMethod: true,
  shippingSource: true,
  shippingAddressJson: true,
  shippingAgencyJson: true,
  // Va al panel del personal (servidor): el comprador nunca ve la cotización cruda.
  shippingQuoteJson: true,
  trackingNumber: true,
  createdAt: true,
  paidAt: true,
  readyAt: true,
  shippedAt: true,
  deliveredAt: true,
  cancelledAt: true,
  items: {
    orderBy: { id: "asc" },
    select: { id: true, productName: true, variantName: true, qty: true, unitPriceArs: true, lineTotalArs: true },
  },
  events: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, fromStatus: true, toStatus: true, actorUserId: true, note: true, createdAt: true },
  },
} satisfies Prisma.StoreOrderSelect;

export type StoreOrderDetail = Prisma.StoreOrderGetPayload<{ select: typeof SELECT_DETALLE }> & {
  sale: { saleNumber: number; status: string } | null;
  actorNames: Record<number, string>;
  problem: boolean;
  amountMismatch: boolean;
};

export async function loadStoreOrderDetail(workspaceId: string, orderId: string): Promise<StoreOrderDetail | null> {
  const order = await prisma.storeOrder.findFirst({ where: { id: orderId, workspaceId }, select: SELECT_DETALLE });
  if (!order) return null;

  const actorIds = [...new Set(order.events.flatMap((e) => (e.actorUserId === null ? [] : [e.actorUserId])))];
  const [sale, actores] = await Promise.all([
    order.saleId
      ? prisma.sale.findFirst({
          where: { id: order.saleId, workspaceId },
          select: { saleNumber: true, status: true },
        })
      : null,
    actorIds.length === 0
      ? []
      : prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, email: true } }),
  ]);

  const entradaSinStock = order.events.filter((e) => e.toStatus === "PAID_NO_STOCK" && e.fromStatus !== "PAID_NO_STOCK").at(-1);
  return {
    ...order,
    sale,
    actorNames: Object.fromEntries(actores.map((u) => [u.id, u.name ?? u.email])),
    problem: isProblemOrder({ status: order.status, events: order.events }),
    amountMismatch: order.status === "PAID_NO_STOCK" && isAmountMismatchNote(entradaSinStock?.note),
  };
}
