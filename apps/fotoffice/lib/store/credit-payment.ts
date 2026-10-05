import "server-only";
import { prisma, type Prisma, type StoreOrderStatus } from "@repo/db";
import { decimalArsToMinor } from "@/lib/membership/money";
import { splitMinorByPlatformFee } from "@/lib/platform-fee/fee";
import { recordDischarge } from "@/lib/platform-fee/ledger";
import { recordSale } from "@/lib/sales/record-sale";
import type { TicketLine } from "@/lib/sales/ticket";
import { availableQty } from "./availability";
import { STORE_NOTE_AMOUNT_MISMATCH, STORE_NOTE_DUPLICATE_PREFIX } from "./constants";
import { lineKey } from "./cart/line-key";
import {
  sendDuplicatePaymentAlert,
  sendNewOrderNotice,
  sendOrderPaidEmail,
  sendPaidNoStockAlert,
} from "./emails";
import { reservedQtyByKey } from "./repository";
import { lockStockRows } from "@/lib/sales/stock-lock";
import { canTransition } from "./transitions";

/**
 * Acreditar el pago de un pedido de la tienda: el punto donde la plata se vuelve una `Sale`.
 *
 * Dos reglas que no se negocian:
 * - **Idempotente.** Mercado Pago avisa varias veces el mismo pago, y el webhook, la vuelta del
 *   comprador y el cron pueden llegar a la vez. Un mismo pago crea UNA venta, nunca dos.
 * - **Nunca se pierde un pago.** Si la plata entró, el pedido lo dice: pagado (con su venta), o
 *   pagado sin stock (sin venta, para que la institución reponga o devuelva), o —si el pedido ya
 *   estaba pagado con otro pago— una constancia y una alerta de pago duplicado.
 *
 * La venta la escribe SIEMPRE `recordSale` (Caja, stock y cliente en la misma transacción): la
 * tienda no crea ventas por su cuenta (lo verifica `invariants.test.ts`).
 */

type Tx = Prisma.TransactionClient;

const YA_PAGADO: readonly StoreOrderStatus[] = ["PAID", "READY", "DELIVERED", "PAID_NO_STOCK"];

export const SELECT_PEDIDO_A_ACREDITAR = {
  id: true,
  workspaceId: true,
  orderNumber: true,
  status: true,
  mpPaymentId: true,
  buyerName: true,
  buyerEmail: true,
  buyerPhone: true,
  subtotalArs: true,
  shippingArs: true,
  shippingMethod: true,
  totalArs: true,
  feeArs: true,
  feeBps: true,
  items: {
    orderBy: { id: "asc" },
    select: { productId: true, variantId: true, productName: true, variantName: true, qty: true, unitPriceArs: true },
  },
} satisfies Prisma.StoreOrderSelect;

export type OrderToFinalize = Prisma.StoreOrderGetPayload<{ select: typeof SELECT_PEDIDO_A_ACREDITAR }>;

// ── Regla pura ─────────────────────────────────────────────────────────────

/**
 * ¿Alcanza el stock para entregar el pedido entero? `reserved` son las unidades que retienen
 * OTROS pedidos (no éste). Un producto o talle que ya no existe no alcanza: la plata entró por
 * algo que no se puede entregar sin que alguien lo mire.
 *
 * Tampoco alcanza un renglón SIN talle de un producto que HOY tiene talles (`hasVariants`): el
 * pedido se hizo antes de que se le cargaran talles. Desde ese momento su stock vive en los
 * talles (D4) y `Product.stockQty` es la suma; vender "el producto" sin talle restaría de la
 * suma sin que ningún talle baje, y dejaría de cuadrar. Que alguien elija el talle a mano.
 */
export function hasStockForOrder(
  items: readonly { productId: string | null; variantId: string | null; qty: number }[],
  products: ReadonlyMap<string, { tracksStock: boolean; stockQty: number; hasVariants?: boolean }>,
  variantStock: ReadonlyMap<string, number>,
  reserved: ReadonlyMap<string, number>,
): boolean {
  // El mismo producto y talle puede repetirse en renglones distintos: se suma por clave.
  const pedidoPorClave = new Map<string, { productId: string; variantId: string | null; qty: number }>();
  for (const it of items) {
    if (!it.productId) return false;
    const key = lineKey({ productId: it.productId, variantId: it.variantId });
    const previo = pedidoPorClave.get(key);
    if (previo) previo.qty += it.qty;
    else pedidoPorClave.set(key, { productId: it.productId, variantId: it.variantId, qty: it.qty });
  }

  for (const [key, linea] of pedidoPorClave) {
    const producto = products.get(linea.productId);
    if (!producto) return false;
    if (!linea.variantId && producto.hasVariants) return false;
    let stockQty = producto.stockQty;
    if (linea.variantId) {
      const deTalle = variantStock.get(linea.variantId);
      if (deTalle === undefined) return false;
      stockQty = deTalle;
    }
    const disponible = availableQty({
      stockQty,
      tracksStock: producto.tracksStock,
      reservedQty: reserved.get(key) ?? 0,
    });
    if (disponible !== null && disponible < linea.qty) return false;
  }
  return true;
}

function descripcion(item: { productName: string; variantName: string | null }): string {
  return item.productName + (item.variantName ? ` — ${item.variantName}` : "");
}

/**
 * El envío como renglón suelto de la venta (E12): sin producto ni costo, así la venta (y Caja)
 * suman lo mismo que se cobró. `null` si el pedido no lleva envío.
 */
export function shippingTicketLine(order: { shippingArs: OrderToFinalize["shippingArs"]; shippingMethod: string | null }): TicketLine | null {
  const envioMinor = decimalArsToMinor(order.shippingArs);
  if (envioMinor <= 0) return null;
  return {
    productId: null,
    variantId: null,
    description: order.shippingMethod === "BRANCH" ? "Envío a sucursal" : "Envío a domicilio",
    qty: 1,
    unitPriceMinor: envioMinor,
    unitCostMinor: null,
    priceWasOverridden: false,
  };
}

// ── Con base ────────────────────────────────────────────────────────────────

/**
 * Convierte un pedido cobrado en una venta: crea la `Sale` con `recordSale` (deposita en Caja,
 * descuenta el stock y da de alta al cliente), asienta la deuda de comisión que Mercado Pago ya
 * retuvo, y deja el pedido en `PAID` con su venta, su cliente y un evento.
 *
 * Corre dentro de la transacción de quien llama, con el pedido y el stock ya bloqueados. La usan
 * la acreditación (`PENDING_PAYMENT`/`EXPIRED` → `PAID`) y la reposición de stock de un pedido
 * pagado sin stock (`PAID_NO_STOCK` → `PAID`).
 */
export async function finalizePaidOrder(
  tx: Tx,
  order: OrderToFinalize,
  paidAt: Date,
  opts: { note?: string; actorUserId?: number | null } = {},
): Promise<{ saleId: string; saleNumber: number }> {
  const productIds = [...new Set(order.items.flatMap((i) => (i.productId ? [i.productId] : [])))];
  // El costo es el del producto HOY: el pedido no lo guarda (no es un dato del comprador).
  const costos = new Map(
    productIds.length === 0
      ? []
      : (
          await tx.product.findMany({
            where: { id: { in: productIds }, workspaceId: order.workspaceId },
            select: { id: true, costArs: true },
          })
        ).map((p) => [p.id, p.costArs === null ? null : decimalArsToMinor(p.costArs)] as const),
  );

  const lines: TicketLine[] = order.items.map((i) => ({
    productId: i.productId,
    variantId: i.variantId,
    description: descripcion(i),
    qty: i.qty,
    unitPriceMinor: decimalArsToMinor(i.unitPriceArs),
    unitCostMinor: i.productId ? (costos.get(i.productId) ?? null) : null,
    priceWasOverridden: false,
  }));
  const envio = shippingTicketLine(order);
  if (envio) lines.push(envio);

  const venta = await recordSale(tx, {
    workspaceId: order.workspaceId,
    createdByUserId: opts.actorUserId ?? null,
    occurredAt: paidAt,
    paymentMethod: "MERCADO_PAGO",
    discountMinor: 0,
    note: `Pedido online #${order.orderNumber}`,
    client: {
      mode: "new",
      firstName: order.buyerName,
      lastName: null,
      phone: order.buyerPhone,
      email: order.buyerEmail,
    },
    lines,
  });
  // `recordSale` no devuelve el cliente: se lee de la venta recién creada (puede ser null si el
  // módulo Clientes está apagado).
  const conCliente = await tx.sale.findUnique({ where: { id: venta.saleId }, select: { clientId: true } });

  // La comisión ya la retuvo Mercado Pago en la operación. Igual que en `creditBookingPayment`:
  // lo retenido por encima de la comisión PROPIA (con el `feeBps` congelado en el pedido) era
  // deuda arrastrada, y el asiento negativo la cancela. La comisión propia es sobre los productos
  // (E11), igual que al abrir el pago (`payment.ts`): el envío no la paga.
  const retenido = decimalArsToMinor(order.feeArs);
  const propio = splitMinorByPlatformFee(decimalArsToMinor(order.subtotalArs), order.feeBps).feeMinor;
  const aDeuda = Math.max(0, retenido - propio);
  if (aDeuda > 0) {
    await recordDischarge(tx, {
      workspaceId: order.workspaceId,
      amountMinor: aDeuda,
      note: `Deuda cobrada en el pedido online #${order.orderNumber} (${order.id})`,
    });
  }

  await tx.storeOrder.updateMany({
    where: { id: order.id, workspaceId: order.workspaceId },
    data: { status: "PAID", paidAt, saleId: venta.saleId, clientId: conCliente?.clientId ?? null },
  });
  await tx.storeOrderEvent.create({
    data: {
      orderId: order.id,
      fromStatus: order.status,
      toStatus: "PAID",
      actorUserId: opts.actorUserId ?? null,
      note: opts.note ?? `Venta #${venta.saleNumber} registrada`,
    },
  });

  return { saleId: venta.saleId, saleNumber: venta.saleNumber };
}

/**
 * Bloquea el stock del pedido (después del pedido, que quien llama ya bloqueó) y responde si
 * alcanza para entregarlo entero, sin contar la retención del propio pedido. La usan la
 * acreditación y la reposición de stock desde el panel (`order-admin.ts`).
 */
export async function lockAndCheckOrderStock(tx: Tx, order: OrderToFinalize): Promise<boolean> {
  const workspaceId = order.workspaceId;
  await lockStockRows(tx, {
    workspaceId,
    productIds: order.items.flatMap((i) => (i.productId ? [i.productId] : [])),
    variantIds: order.items.flatMap((i) => (i.variantId ? [i.variantId] : [])),
  });
  // Recién con el stock bloqueado. Este pedido no compite contra su propia retención.
  const reservado = await reservedQtyByKey(workspaceId, tx, { excludeOrderId: order.id });

  const productIds = [...new Set(order.items.flatMap((i) => (i.productId ? [i.productId] : [])))];
  const variantIds = [...new Set(order.items.flatMap((i) => (i.variantId ? [i.variantId] : [])))];
  const [productos, talles] = await Promise.all([
    productIds.length === 0
      ? []
      : tx.product.findMany({
          where: { id: { in: productIds }, workspaceId },
          // Un talle cualquiera alcanza para saber si el producto tiene talles HOY (activos o
          // no: el stock de un talle desactivado también vive en el talle).
          select: {
            id: true,
            tracksStock: true,
            stockQty: true,
            variants: { where: { workspaceId }, select: { id: true }, take: 1 },
          },
        }),
    variantIds.length === 0
      ? []
      : tx.productVariant.findMany({
          where: { id: { in: variantIds }, workspaceId },
          select: { id: true, stockQty: true },
        }),
  ]);

  return hasStockForOrder(
    order.items,
    new Map(
      productos.map((p) => [
        p.id,
        { tracksStock: p.tracksStock, stockQty: p.stockQty, hasVariants: p.variants.length > 0 },
      ]),
    ),
    new Map(talles.map((v) => [v.id, v.stockQty])),
    reservado,
  );
}

export type CreditStorePaymentResult = { applied: boolean; status: StoreOrderStatus | null; motivo?: string };

type Resultado =
  | { kind: "aplicado"; status: StoreOrderStatus }
  | { kind: "repetido"; status: StoreOrderStatus }
  | { kind: "duplicado"; status: StoreOrderStatus }
  | { kind: "invalido"; status: StoreOrderStatus | null; motivo: string };

/**
 * Acredita un pago APROBADO de Mercado Pago (quien llama ya lo verificó con el token de la
 * institución). Ver el comentario del archivo para las garantías.
 */
export async function creditStorePayment(input: {
  orderId: string;
  providerPaymentId: string;
  /** Lo que Mercado Pago dice que se cobró. Se compara con el total del pedido. */
  amountMinor: number;
  currency: string;
  /** `date_approved` de Mercado Pago; si no viene, ahora. Es la fecha de la venta. */
  paidAt?: Date | null;
}): Promise<CreditStorePaymentResult> {
  const paidAt = input.paidAt ?? new Date();
  const cabecera = await prisma.storeOrder.findUnique({
    where: { id: input.orderId },
    select: { workspaceId: true },
  });
  if (!cabecera) return { applied: false, status: null, motivo: "el pedido no existe" };
  const workspaceId = cabecera.workspaceId;

  const resultado = await prisma.$transaction(
    async (tx): Promise<Resultado> => {
      // El pedido se bloquea ANTES de leer su estado: dos avisos del mismo pago que llegan a la
      // vez se ordenan acá, y el segundo ya ve el pedido pagado. Siempre pedido primero y stock
      // después, en todos los caminos que tocan los dos (evita interbloqueos).
      await tx.$queryRaw`SELECT "id" FROM "StoreOrder" WHERE "id" = ${input.orderId} AND "workspaceId" = ${workspaceId} FOR UPDATE`;
      const order = await tx.storeOrder.findFirst({
        where: { id: input.orderId, workspaceId },
        select: SELECT_PEDIDO_A_ACREDITAR,
      });
      if (!order) return { kind: "invalido", status: null, motivo: "el pedido no existe" };

      // La idempotencia la decide el PAGO, no el estado: un pedido que ya tiene un pago guardado
      // (pagado, listo, entregado, sin stock… o cancelado después de pagarse) no vuelve a
      // acreditarse. El mismo pago es un aviso repetido; otro pago es un pago doble.
      if (order.mpPaymentId !== null || YA_PAGADO.includes(order.status)) {
        if (order.mpPaymentId === input.providerPaymentId) return { kind: "repetido", status: order.status };
        // No se toca el pedido (`mpPaymentId` es único y es el del primer pago); queda la
        // constancia para devolver el segundo.
        const nota = `${STORE_NOTE_DUPLICATE_PREFIX} ${input.providerPaymentId}: hay que devolverlo`;
        const yaAnotado = await tx.storeOrderEvent.findFirst({
          where: { orderId: order.id, note: nota },
          select: { id: true },
        });
        if (yaAnotado) return { kind: "repetido", status: order.status };
        await tx.storeOrderEvent.create({
          data: { orderId: order.id, fromStatus: order.status, toStatus: order.status, note: nota },
        });
        return { kind: "duplicado", status: order.status };
      }

      // Se cobró otra cosa que el total del pedido (o en otra moneda): la plata está, pero no se
      // da por pagado sin que una persona lo mire. Sin venta.
      if (!montoCubre(input, decimalArsToMinor(order.totalArs))) {
        await pasarASinStock(tx, order, input.providerPaymentId, paidAt, STORE_NOTE_AMOUNT_MISMATCH);
        return { kind: "aplicado", status: "PAID_NO_STOCK" };
      }

      // Siempre se bloquea el stock (aunque el pedido esté cancelado): el orden de los bloqueos
      // es el mismo en todos los caminos.
      const hayStock = await lockAndCheckOrderStock(tx, order);
      const alcanza = order.status !== "CANCELLED" && hayStock;
      const destino: StoreOrderStatus = alcanza ? "PAID" : "PAID_NO_STOCK";
      if (!canTransition(order.status, destino, "system")) {
        return { kind: "invalido", status: order.status, motivo: `no se puede pasar de ${order.status} a ${destino}` };
      }

      if (alcanza) {
        await tx.storeOrder.updateMany({
          where: { id: order.id, workspaceId },
          data: { mpPaymentId: input.providerPaymentId, holdExpiresAt: null },
        });
        await finalizePaidOrder(tx, order, paidAt, {
          note: `Pago ${input.providerPaymentId} aprobado en Mercado Pago`,
        });
        return { kind: "aplicado", status: "PAID" };
      }

      // La plata está y el stock no (o el pedido se había cancelado): sin venta. La institución
      // decide si repone (→ PAID, con su venta) o devuelve el dinero.
      await pasarASinStock(
        tx,
        order,
        input.providerPaymentId,
        paidAt,
        order.status === "CANCELLED"
          ? `Pago ${input.providerPaymentId} aprobado sobre un pedido cancelado`
          : `Pago ${input.providerPaymentId} aprobado sin stock suficiente`,
      );
      return { kind: "aplicado", status: "PAID_NO_STOCK" };
    },
    { isolationLevel: "ReadCommitted" },
  );

  // Los avisos van DESPUÉS de confirmar: un correo que falla no puede volcar un cobro, y un
  // cobro que se vuelca no puede haber mandado un "recibimos tu pago".
  const ref = { workspaceId, orderId: input.orderId };
  switch (resultado.kind) {
    case "aplicado":
      if (resultado.status === "PAID") {
        await avisar(() => sendOrderPaidEmail(ref));
        await avisar(() => sendNewOrderNotice(ref));
      } else {
        await avisar(() => sendPaidNoStockAlert(ref));
      }
      return { applied: true, status: resultado.status };
    case "duplicado":
      await avisar(() => sendDuplicatePaymentAlert({ ...ref, providerPaymentId: input.providerPaymentId }));
      return { applied: false, status: resultado.status, motivo: "pago duplicado" };
    case "repetido":
      return { applied: false, status: resultado.status, motivo: "aviso repetido" };
    case "invalido":
      return { applied: false, status: resultado.status, motivo: resultado.motivo };
  }
}

/** ¿El pago cubre el pedido? En pesos y por lo menos el total. Módulo puro. */
export function montoCubre(pago: { amountMinor: number; currency: string }, totalMinor: number): boolean {
  return pago.currency === "ARS" && Number.isInteger(pago.amountMinor) && pago.amountMinor >= totalMinor;
}

async function pasarASinStock(
  tx: Tx,
  order: OrderToFinalize,
  providerPaymentId: string,
  paidAt: Date,
  note: string,
): Promise<void> {
  await tx.storeOrder.updateMany({
    where: { id: order.id, workspaceId: order.workspaceId },
    data: { status: "PAID_NO_STOCK", paidAt, mpPaymentId: providerPaymentId, holdExpiresAt: null },
  });
  await tx.storeOrderEvent.create({
    data: { orderId: order.id, fromStatus: order.status, toStatus: "PAID_NO_STOCK", note },
  });
}

async function avisar(enviar: () => Promise<void>): Promise<void> {
  try {
    await enviar();
  } catch (error) {
    // Sin datos del comprador: sólo que falló. El pago ya quedó acreditado.
    console.error("[fotoffice][tienda] falló un aviso por correo", {
      detalle: error instanceof Error ? error.message : "desconocido",
    });
  }
}
