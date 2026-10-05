import "server-only";
import { Prisma, prisma } from "@repo/db";
import { formatMinorArs, minorToDecimalString } from "@/lib/membership/money";
import { hashAccessToken, newPublicId, orderAccessToken, resolveOrderTokenKey } from "./access-token";
import { lineKey } from "./cart/line-key";
import type { CheckoutDelivery, CheckoutInput } from "./checkout-input";
import { STORE_HOLD_MINUTES, STORE_LEGAL_VERSION, STORE_MAX_PENDING_PER_EMAIL } from "./constants";
import { loadCartCatalog, reservedQtyByKey } from "./repository";
import { lockStockRows } from "@/lib/sales/stock-lock";
import { checkCartLines, type CartProblem } from "./storefront";
import { SHIPPING_FAILURE_MESSAGES } from "./shipping/checkout";
import { loadAgenciesForOrder, loadCheckoutDeliveryOptions } from "./shipping/checkout-server";
import { quoteShipping, type ShippingQuote } from "./shipping/quote";

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
 *    compradores se lleven la última unidad (ver `lib/sales/stock-lock.ts`).
 *
 * Precios, nombres, talles e imagen salen SIEMPRE del servidor (D14): del navegador sólo se usan
 * qué producto, qué talle y cuántos.
 *
 * Con envío, el precio del envío también: se vuelve a cotizar acá (E10), ANTES de abrir la
 * transacción (cotizar puede ir a la red de Correo y no se hace con el stock bloqueado). De una
 * sucursal, del navegador sólo se usa el id: nombre, dirección y CP salen de la lista de Correo.
 */

export type CreateStoreOrderResult =
  | { ok: true; orderId: string; publicId: string; accessToken: string }
  | {
      ok: false;
      error: string;
      problems?: CartProblem[];
      /** La clave de compra ya nombra a otro pedido que no sirve: el navegador tiene que generar otra. */
      renewKey?: boolean;
      /** El envío re-cotizado es más caro que el que vio (o no vio ninguno): mostrar éste y volver a confirmar. */
      shippingChanged?: { totalMinor: number; serviceName: string };
    };

const SIN_CLAVE = "La tienda no está lista para cobrar. Escribile a la institución.";
const DEMASIADOS_PENDIENTES = "Tenés varios pedidos esperando el pago. Terminá uno o esperá unos minutos.";
const YA_PROCESADO = "Ese pedido ya se procesó.";
const CAMBIO_EL_CARRITO = "Algo de tu carrito cambió. Revisalo y volvé a confirmar.";
const ENVIO_NO_DISPONIBLE = SHIPPING_FAILURE_MESSAGES.DISABLED;
const NO_SE_PUDO_COTIZAR = "No pudimos calcular el envío. Probá de nuevo o elegí retiro.";
const SUCURSAL_NO_DISPONIBLE = "Esa sucursal ya no está disponible. Elegí otra.";

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

/**
 * A dónde va el pedido, como texto comparable: con la misma clave de compra no se devuelve un
 * pedido que va a otro lado (se cotizó y se cobra otro envío).
 */
function destinoDeLaEntrega(delivery: CheckoutDelivery): string {
  switch (delivery.method) {
    case "PICKUP":
      return "PICKUP";
    case "HOME": {
      const a = delivery.address;
      return ["HOME", a.postalCode, a.provinceCode, a.city, a.street, a.number, a.floorApt ?? ""].join("|");
    }
    case "BRANCH":
      return ["BRANCH", delivery.agency.id].join("|");
  }
}

function campo(json: unknown, key: string): string {
  if (typeof json !== "object" || json === null) return "";
  const v = (json as Record<string, unknown>)[key];
  return typeof v === "string" ? v : "";
}

function destinoGuardado(o: {
  deliveryMethod?: string | null;
  shippingMethod?: string | null;
  shippingAddressJson?: Prisma.JsonValue | null;
  shippingAgencyJson?: Prisma.JsonValue | null;
}): string {
  if (o.deliveryMethod !== "SHIPPING") return "PICKUP";
  if (o.shippingMethod === "HOME") {
    const a = o.shippingAddressJson;
    return [
      "HOME",
      campo(a, "postalCode"),
      campo(a, "provinceCode"),
      campo(a, "city"),
      campo(a, "street"),
      campo(a, "number"),
      campo(a, "floorApt"),
    ].join("|");
  }
  if (o.shippingMethod === "BRANCH") return ["BRANCH", campo(o.shippingAgencyJson, "id")].join("|");
  // Un envío sin método conocido no coincide con nada: mejor una clave nueva que el pedido equivocado.
  return "?";
}

const SELECT_EXISTENTE = {
  id: true,
  publicId: true,
  status: true,
  holdExpiresAt: true,
  buyerEmail: true,
  deliveryMethod: true,
  shippingMethod: true,
  shippingAddressJson: true,
  shippingAgencyJson: true,
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
function repetir(
  existente: Existente,
  compra: { lines: readonly Linea[]; buyerEmail: string; delivery: CheckoutDelivery },
  key: string,
  now: Date,
): CreateStoreOrderResult {
  if (existente.status !== "PENDING_PAYMENT") return { ok: false, error: YA_PROCESADO, renewKey: true };
  if (!existente.holdExpiresAt || existente.holdExpiresAt.getTime() <= now.getTime()) {
    return {
      ok: false,
      error: "Tu pedido anterior venció sin pago. Volvé a confirmar para reservar de nuevo.",
      renewKey: true,
    };
  }
  // La clave se genera por carrito: si el contenido no coincide, no se cobra otro carrito con ella.
  if (!mismaCompra(existente.items, compra.lines)) return { ok: false, error: CAMBIO_EL_CARRITO, renewKey: true };
  // Tampoco con otro email: el pedido (y el aviso de pago) es de quien lo hizo.
  if (existente.buyerEmail !== compra.buyerEmail) {
    return { ok: false, error: "Cambiaste tus datos. Volvé a confirmar para crear el pedido.", renewKey: true };
  }
  // Ni a otro destino: el envío se cotizó (y se cobra) para el que quedó guardado.
  if (destinoGuardado(existente) !== destinoDeLaEntrega(compra.delivery)) {
    return { ok: false, error: "Cambiaste la forma de entrega. Volvé a confirmar para crear el pedido.", renewKey: true };
  }
  return {
    ok: true,
    orderId: existente.id,
    publicId: existente.publicId,
    accessToken: orderAccessToken(existente.publicId, key),
  };
}

/** Lo que se guarda del envío en el pedido. Retiro: nada (las columnas quedan nulas). */
type EnvioDelPedido = {
  shippingMinor: number;
  data: {
    shippingMethod: "HOME" | "BRANCH";
    shippingSource: string;
    shippingQuoteJson: Prisma.InputJsonValue;
    shippingAddressJson?: Prisma.InputJsonValue;
    shippingAgencyJson?: Prisma.InputJsonValue;
  };
};

type EnvioResuelto =
  | { ok: true; envio: EnvioDelPedido | null }
  | { ok: false; error: string; shippingChanged?: { totalMinor: number; serviceName: string } };

/** La cotización entera (base, recargo, paquete y respuesta cruda) como JSON: sólo para el servidor. */
function cotizacionComoJson(quote: ShippingQuote): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(quote)) as Prisma.InputJsonValue;
}

/**
 * Valida la forma de entrega y cotiza el envío en el servidor. Nunca lanza: cualquier error
 * inesperado termina en "no pudimos calcular", y el log no lleva el mensaje (podría traer datos).
 */
async function resolverEnvio(
  workspaceId: string,
  checkout: CheckoutInput,
  lines: readonly Linea[],
): Promise<EnvioResuelto> {
  const delivery = checkout.delivery;
  if (delivery.method === "PICKUP") return { ok: true, envio: null };
  try {
    const opciones = await loadCheckoutDeliveryOptions(workspaceId);
    if (delivery.method === "HOME" ? !opciones.home : !opciones.branch) return { ok: false, error: ENVIO_NO_DISPONIBLE };

    let destino: { postalCode: string; provinceCode: string };
    let lugar: Pick<EnvioDelPedido["data"], "shippingAddressJson" | "shippingAgencyJson">;
    if (delivery.method === "HOME") {
      const a = delivery.address;
      destino = { postalCode: a.postalCode, provinceCode: a.provinceCode };
      lugar = {
        shippingAddressJson: {
          recipientName: checkout.buyerName,
          street: a.street,
          number: a.number,
          floorApt: a.floorApt,
          city: a.city,
          provinceCode: a.provinceCode,
          postalCode: a.postalCode,
          recipientPhone: a.recipientPhone ?? checkout.buyerPhone,
        },
      };
    } else {
      const lista = await loadAgenciesForOrder({ workspaceId, provinceCode: delivery.provinceCode });
      // Correo caído no es "la sucursal no existe": no se le pide que elija otra.
      if (!lista.ok) return { ok: false, error: NO_SE_PUDO_COTIZAR };
      const sucursal = lista.agencies.find((s) => s.id === delivery.agency.id);
      if (!sucursal) return { ok: false, error: SUCURSAL_NO_DISPONIBLE };
      destino = { postalCode: sucursal.postalCode, provinceCode: delivery.provinceCode };
      lugar = {
        shippingAgencyJson: {
          id: sucursal.id,
          name: sucursal.name,
          address: sucursal.address,
          city: sucursal.city,
          postalCode: sucursal.postalCode,
          provinceCode: delivery.provinceCode,
        },
      };
    }

    const r = await quoteShipping({
      workspaceId,
      method: delivery.method,
      destination: destino,
      items: lines.map((l) => ({ productId: l.productId, variantId: l.variantId, qty: l.qty })),
    });
    if (!r.ok) {
      if (r.reason === "DISABLED") return { ok: false, error: ENVIO_NO_DISPONIBLE };
      if (r.reason === "NO_COVERAGE" || r.reason === "TOO_BIG") return { ok: false, error: SHIPPING_FAILURE_MESSAGES[r.reason] };
      return { ok: false, error: NO_SE_PUDO_COTIZAR };
    }
    const q = r.quote;
    // Nunca se vende un envío sin precio (E14). En la tabla, $0 es una zona gratis que cargó la
    // institución; de Correo, un $0 es un error.
    const minimo = q.source === "TABLE" ? 0 : 1;
    if (!Number.isInteger(q.totalMinor) || q.totalMinor < minimo) return { ok: false, error: NO_SE_PUDO_COTIZAR };
    // Se cobra lo re-cotizado, pero si es más de lo que vio (o no vio ningún precio), primero se
    // le muestra: nadie paga un envío más caro sin enterarse. Si bajó, se sigue con el menor.
    if (checkout.shownShippingMinor === null || q.totalMinor > checkout.shownShippingMinor) {
      return {
        ok: false,
        error: `El envío cambió: ahora cuesta ${formatMinorArs(q.totalMinor)}. Revisalo y volvé a confirmar.`,
        shippingChanged: { totalMinor: q.totalMinor, serviceName: q.serviceName },
      };
    }
    return {
      ok: true,
      envio: {
        shippingMinor: q.totalMinor,
        data: {
          shippingMethod: delivery.method,
          shippingSource: q.source,
          shippingQuoteJson: cotizacionComoJson(q),
          ...lugar,
        },
      },
    };
  } catch (error) {
    console.warn("[fotoffice][tienda] no se pudo cotizar el envío del pedido", {
      workspaceId,
      error: error instanceof Error ? error.name : typeof error,
    });
    return { ok: false, error: NO_SE_PUDO_COTIZAR };
  }
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
  const compra = { lines, buyerEmail: checkout.buyerEmail, delivery: checkout.delivery };

  const existente = await buscarPorClave(workspaceId, checkout.clientIdempotencyKey);
  if (existente) return repetir(existente, compra, key, now);

  const pendientes = await prisma.storeOrder.count({
    where: {
      workspaceId,
      buyerEmail: checkout.buyerEmail,
      status: "PENDING_PAYMENT",
      holdExpiresAt: { gt: now },
    },
  });
  if (pendientes >= STORE_MAX_PENDING_PER_EMAIL) return { ok: false, error: DEMASIADOS_PENDIENTES };

  // Fuera de la transacción: cotizar puede tardar (la red de Correo) y no se hace con el stock bloqueado.
  const resuelto = await resolverEnvio(workspaceId, checkout, lines);
  if (!resuelto.ok) {
    return resuelto.shippingChanged
      ? { ok: false, error: resuelto.error, shippingChanged: resuelto.shippingChanged }
      : { ok: false, error: resuelto.error };
  }
  const envio = resuelto.envio;
  const shippingMinor = envio?.shippingMinor ?? 0;

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
                deliveryMethod: envio ? "SHIPPING" : "PICKUP",
                subtotalArs: minorToDecimalString(subtotalMinor),
                shippingArs: minorToDecimalString(shippingMinor),
                totalArs: minorToDecimalString(subtotalMinor + shippingMinor),
                ...(envio ? envio.data : {}),
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
      if (otro) return repetir(otro, compra, key, now);
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
    return repetir(otro, compra, key, now);
  }
  return { ok: true, orderId: resultado.orderId, publicId: resultado.publicId, accessToken };
}
