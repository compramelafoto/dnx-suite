import "server-only";
import { Prisma, prisma } from "@repo/db";
import { minorToDecimalString } from "@/lib/membership/money";
import { hashAccessToken, newPublicId, orderAccessToken, resolveOrderTokenKey } from "./access-token";
import { lineKey } from "./cart/line-key";
import type { CheckoutInput } from "./checkout-input";
import { STORE_HOLD_MINUTES, STORE_LEGAL_VERSION, STORE_MAX_PENDING_PER_EMAIL } from "./constants";
import { loadCartCatalog, reservedQtyByKey } from "./repository";
import { lockStockRows } from "./stock-lock";
import { checkCartLines, type CartProblem } from "./storefront";

/**
 * Crea el pedido de la tienda y RETIENE el stock mientras se paga (§6.1, D7).
 *
 * Tres barreras antes de escribir, en este orden:
 * 1. **Idempotencia** por `clientIdempotencyKey`: el doble clic, o volver atrás y apretar de nuevo,
 *    devuelve el MISMO pedido (y el mismo token: es determinista, ver `access-token.ts`).
 * 2. **Límite por email**: no más de 3 pedidos esperando el pago a la vez. Sin esto, alguien
 *    podría dejar la tienda "agotada" sin pagar nada.
 * 3. **Disponibilidad bajo bloqueo**, dentro de la transacción: se bloquean las filas de stock y
 *    recién después se suma lo retenido por otros pedidos. Es lo que hace imposible que dos
 *    compradores se lleven la última unidad (ver `stock-lock.ts`).
 *
 * Precios, nombres, talles e imagen salen SIEMPRE del servidor (D14): del navegador sólo se usan
 * qué producto, qué talle y cuántos.
 */

export type CreateStoreOrderResult =
  | { ok: true; orderId: string; publicId: string; accessToken: string }
  | {
      ok: false;
      error: string;
      problems?: CartProblem[];
      /** La clave de compra ya nombra a otro pedido que no sirve: el navegador tiene que generar otra. */
      renewKey?: boolean;
    };

const SIN_CLAVE = "La tienda no está lista para cobrar. Escribile a la institución.";
const DEMASIADOS_PENDIENTES = "Tenés varios pedidos esperando el pago. Terminá uno o esperá unos minutos.";
const YA_PROCESADO = "Ese pedido ya se procesó.";
const CAMBIO_EL_CARRITO = "Algo de tu carrito cambió. Revisalo y volvé a confirmar.";

type Linea = CheckoutInput["lines"][number];

/** Une las líneas repetidas (mismo producto y talle) sumando cantidades, en el orden en que llegaron. */
export function mergeCheckoutLines(lines: readonly Linea[]): Linea[] {
  const porClave = new Map<string, Linea>();
  for (const l of lines) {
    const key = lineKey(l);
    const previa = porClave.get(key);
    if (previa) previa.qty += l.qty;
    else porClave.set(key, { productId: l.productId, variantId: l.variantId, qty: l.qty });
  }
  return [...porClave.values()];
}

function mismaCompra(
  a: readonly { productId: string | null; variantId: string | null; qty: number }[],
  b: readonly Linea[],
): boolean {
  const firma = (ls: readonly { productId: string | null; variantId: string | null; qty: number }[]) =>
    ls
      .map((l) => `${l.productId ?? "?"}:${l.variantId ?? "-"}=${l.qty}`)
      .sort()
      .join("|");
  return firma(a) === firma(b);
}

const SELECT_EXISTENTE = {
  id: true,
  publicId: true,
  status: true,
  holdExpiresAt: true,
  items: { select: { productId: true, variantId: true, qty: true } },
} satisfies Prisma.StoreOrderSelect;

type Existente = Prisma.StoreOrderGetPayload<{ select: typeof SELECT_EXISTENTE }>;

function buscarPorClave(workspaceId: string, clientIdempotencyKey: string) {
  return prisma.storeOrder.findUnique({
    where: { workspaceId_clientIdempotencyKey: { workspaceId, clientIdempotencyKey } },
    select: SELECT_EXISTENTE,
  });
}

/** La respuesta a una clave que ya nombra a un pedido: el mismo pedido si todavía sirve. */
function repetir(existente: Existente, lines: readonly Linea[], key: string, now: Date): CreateStoreOrderResult {
  if (existente.status !== "PENDING_PAYMENT") return { ok: false, error: YA_PROCESADO, renewKey: true };
  if (!existente.holdExpiresAt || existente.holdExpiresAt.getTime() <= now.getTime()) {
    return {
      ok: false,
      error: "Tu pedido anterior venció sin pago. Volvé a confirmar para reservar de nuevo.",
      renewKey: true,
    };
  }
  // La clave se genera por carrito: si el contenido no coincide, no se cobra otro carrito con ella.
  if (!mismaCompra(existente.items, lines)) return { ok: false, error: CAMBIO_EL_CARRITO, renewKey: true };
  return {
    ok: true,
    orderId: existente.id,
    publicId: existente.publicId,
    accessToken: orderAccessToken(existente.publicId, key),
  };
}

type ResultadoTx =
  | { kind: "creado"; orderId: string; publicId: string }
  | { kind: "problemas"; problems: CartProblem[] }
  | { kind: "duplicado" };

export async function createStoreOrder(input: {
  workspaceId: string;
  memberId: string | null;
  checkout: CheckoutInput;
  now?: Date;
}): Promise<CreateStoreOrderResult> {
  const { workspaceId, checkout } = input;
  const now = input.now ?? new Date();

  // Sin clave no se puede dar acceso al pedido: se falla ANTES de reservar nada.
  const key = resolveOrderTokenKey();
  if (!key) {
    console.warn("[fotoffice][tienda] Falta STORE_ORDER_TOKEN_SECRET: no se pueden crear pedidos", { workspaceId });
    return { ok: false, error: SIN_CLAVE };
  }

  const lines = mergeCheckoutLines(checkout.lines);

  const existente = await buscarPorClave(workspaceId, checkout.clientIdempotencyKey);
  if (existente) return repetir(existente, lines, key, now);

  const pendientes = await prisma.storeOrder.count({
    where: {
      workspaceId,
      buyerEmail: checkout.buyerEmail,
      status: "PENDING_PAYMENT",
      holdExpiresAt: { gt: now },
    },
  });
  if (pendientes >= STORE_MAX_PENDING_PER_EMAIL) return { ok: false, error: DEMASIADOS_PENDIENTES };

  const publicId = newPublicId();
  const accessToken = orderAccessToken(publicId, key);
  const holdExpiresAt = new Date(now.getTime() + STORE_HOLD_MINUTES * 60_000);

  let resultado: ResultadoTx;
  try {
    resultado = await prisma.$transaction(
      async (tx): Promise<ResultadoTx> => {
        await lockStockRows(tx, {
          workspaceId,
          productIds: lines.map((l) => l.productId),
          variantIds: lines.flatMap((l) => (l.variantId ? [l.variantId] : [])),
        });

        // Recién con las filas bloqueadas: lo retenido incluye a quien acaba de confirmar antes.
        const [catalogo, reservado] = await Promise.all([
          loadCartCatalog(
            workspaceId,
            lines.map((l) => l.productId),
            tx,
          ),
          reservedQtyByKey(workspaceId, tx, { now }),
        ]);
        const revisado = checkCartLines(catalogo, lines, reservado);
        // Cualquier ajuste (agotado, menos cantidad, talle inactivo, máximo por compra) frena la
        // compra: se cobra exactamente lo que la persona vio y aceptó, o nada.
        if (revisado.problems.length > 0 || revisado.lines.length === 0) {
          return { kind: "problemas", problems: revisado.problems };
        }

        const subtotalMinor = revisado.lines.reduce((s, l) => s + l.unitPriceMinor * l.qty, 0);

        // Número correlativo: mismo patrón que `recordSale` (createMany + skipDuplicates + relectura).
        // NO un `create` con `catch` de P2002: un error dentro de la transacción la aborta entera.
        let creado: { id: string } | null = null;
        for (let intento = 0; intento < 3 && !creado; intento++) {
          const ultimo = await tx.storeOrder.findFirst({
            where: { workspaceId },
            orderBy: { orderNumber: "desc" },
            select: { orderNumber: true },
          });
          const orderNumber = (ultimo?.orderNumber ?? 0) + 1;
          const r = await tx.storeOrder.createMany({
            data: [
              {
                workspaceId,
                publicId,
                orderNumber,
                accessTokenHash: hashAccessToken(accessToken),
                status: "PENDING_PAYMENT",
                buyerName: checkout.buyerName,
                buyerEmail: checkout.buyerEmail,
                buyerPhone: checkout.buyerPhone,
                memberId: input.memberId,
                deliveryMethod: "PICKUP",
                subtotalArs: minorToDecimalString(subtotalMinor),
                shippingArs: minorToDecimalString(0),
                totalArs: minorToDecimalString(subtotalMinor),
                holdExpiresAt,
                legalAcceptedAt: now,
                legalVersion: STORE_LEGAL_VERSION,
                clientIdempotencyKey: checkout.clientIdempotencyKey,
              },
            ],
            skipDuplicates: true,
          });
          if (r.count === 1) {
            creado = await tx.storeOrder.findUniqueOrThrow({ where: { publicId }, select: { id: true } });
            break;
          }
          // `count === 0`: chocó un único. Puede ser el número (otro pedido lo tomó) o la clave de
          // compra (un doble envío que llegó a la vez). Si es la clave, ese pedido es la respuesta.
          const gemelo = await tx.storeOrder.findUnique({
            where: {
              workspaceId_clientIdempotencyKey: { workspaceId, clientIdempotencyKey: checkout.clientIdempotencyKey },
            },
            select: { id: true },
          });
          if (gemelo) return { kind: "duplicado" };
        }
        if (!creado) throw new Error("No se pudo asignar un número de pedido después de tres intentos.");
        const orderId = creado.id;

        await tx.storeOrderItem.createMany({
          data: revisado.lines.map((l) => ({
            orderId,
            productId: l.productId,
            variantId: l.variantId,
            productName: l.name,
            variantName: l.variantName,
            productSlug: l.slug,
            imageUrl: l.imageUrl,
            qty: l.qty,
            unitPriceArs: minorToDecimalString(l.unitPriceMinor),
            lineTotalArs: minorToDecimalString(l.unitPriceMinor * l.qty),
          })),
        });
        await tx.storeOrderEvent.create({
          data: { orderId, fromStatus: null, toStatus: "PENDING_PAYMENT", note: "Pedido creado en la tienda online" },
        });

        return { kind: "creado", orderId, publicId };
      },
      { isolationLevel: "ReadCommitted" },
    );
  } catch (error) {
    // Fuera de la transacción (ya volcada) sí se puede mirar un P2002: si fue la clave de compra,
    // el otro envío ganó y su pedido es la respuesta.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const otro = await buscarPorClave(workspaceId, checkout.clientIdempotencyKey);
      if (otro) return repetir(otro, lines, key, now);
    }
    throw error;
  }

  if (resultado.kind === "problemas") {
    return {
      ok: false,
      error: "Tu carrito cambió mientras comprabas. Revisá los avisos y volvé a confirmar.",
      problems: resultado.problems,
    };
  }
  if (resultado.kind === "duplicado") {
    const otro = await buscarPorClave(workspaceId, checkout.clientIdempotencyKey);
    if (!otro) return { ok: false, error: "No pudimos crear el pedido. Probá de nuevo." };
    return repetir(otro, lines, key, now);
  }
  return { ok: true, orderId: resultado.orderId, publicId: resultado.publicId, accessToken };
}
