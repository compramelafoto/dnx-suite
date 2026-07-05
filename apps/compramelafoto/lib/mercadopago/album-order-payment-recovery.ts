import {
  CheckoutPaymentSource,
  OrderOrigin,
  type OrderStatus,
} from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import type { AuthUser } from "@/lib/auth";
import { normalizeEmail } from "@/lib/order-claims";
import { ensureAlbumOrderMpPreference } from "@/lib/mercadopago/album-order-mp-preference";

const SUPPORTED_ORIGINS: OrderOrigin[] = [
  OrderOrigin.STANDARD_CHECKOUT,
  OrderOrigin.PREVENTA_PACK,
];

export type AlbumOrderFailureContext = {
  orderId: number;
  orderType: "ALBUM_ORDER";
  total: number;
  albumTitle: string | null;
  albumSlug: string | null;
  orderStatus: OrderStatus;
  canRetry: boolean;
  backUrl: string;
  isPreventaPack: boolean;
};

export function isAlbumOrderRecoveryScope(orderType: string | null | undefined): boolean {
  return (orderType || "").trim().toUpperCase() === "ALBUM_ORDER";
}

export function buyerCanAccessAlbumOrder(
  order: { buyerUserId: number | null; buyerEmail: string },
  authUser: AuthUser | null,
  buyerEmailInput?: string | null
): boolean {
  if (authUser) {
    if (order.buyerUserId != null && order.buyerUserId === authUser.id) {
      return true;
    }
    const userEmailNorm = authUser.email ? normalizeEmail(authUser.email) : "";
    const orderEmailNorm = order.buyerEmail ? normalizeEmail(order.buyerEmail) : "";
    if (
      order.buyerUserId == null &&
      authUser.emailVerifiedAt &&
      userEmailNorm &&
      userEmailNorm === orderEmailNorm
    ) {
      return true;
    }
  }

  const provided = buyerEmailInput ? normalizeEmail(buyerEmailInput) : "";
  const orderEmailNorm = order.buyerEmail ? normalizeEmail(order.buyerEmail) : "";
  if (provided && orderEmailNorm && provided === orderEmailNorm) {
    return true;
  }

  return false;
}

export function buildAlbumOrderFailureBackUrl(
  origin: OrderOrigin,
  publicSlug: string | null | undefined
): string {
  const slug = (publicSlug || "").trim();
  if (!slug) {
    return "/";
  }
  if (origin === OrderOrigin.PREVENTA_PACK) {
    return `/album/${slug}/preventa`;
  }
  return `/a/${slug}`;
}

export function albumOrderCanRetryPayment(order: {
  status: OrderStatus;
  isTest: boolean;
  checkoutPaymentSource: CheckoutPaymentSource;
  origin: OrderOrigin;
}): boolean {
  if (order.isTest) return false;
  if (order.checkoutPaymentSource !== CheckoutPaymentSource.MERCADO_PAGO) return false;
  if (!SUPPORTED_ORIGINS.includes(order.origin)) return false;
  return order.status === "PENDING" || order.status === "FAILED";
}

type LoadedAlbumOrder = {
  id: number;
  status: OrderStatus;
  totalCents: number;
  isTest: boolean;
  checkoutPaymentSource: CheckoutPaymentSource;
  origin: OrderOrigin;
  buyerEmail: string;
  buyerUserId: number | null;
  album: { title: string | null; publicSlug: string } | null;
};

async function loadAlbumOrderForRecovery(orderId: number): Promise<LoadedAlbumOrder | null> {
  return prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      totalCents: true,
      isTest: true,
      checkoutPaymentSource: true,
      origin: true,
      buyerEmail: true,
      buyerUserId: true,
      album: {
        select: {
          title: true,
          publicSlug: true,
        },
      },
    },
  });
}

export async function getAlbumOrderFailureContext(
  orderId: number,
  authUser: AuthUser | null,
  buyerEmailInput?: string | null
): Promise<
  | { ok: true; context: AlbumOrderFailureContext }
  | { ok: false; httpStatus: number; error: string; code?: string; retryRequiresEmail?: boolean }
> {
  const order = await loadAlbumOrderForRecovery(orderId);
  if (!order) {
    return { ok: false, httpStatus: 404, error: "Pedido no encontrado" };
  }

  if (!SUPPORTED_ORIGINS.includes(order.origin)) {
    return {
      ok: false,
      httpStatus: 400,
      error: "Este tipo de pedido no admite recuperación desde esta pantalla.",
      code: "UNSUPPORTED_ORDER",
    };
  }

  if (!buyerCanAccessAlbumOrder(order, authUser, buyerEmailInput)) {
    return {
      ok: false,
      httpStatus: 403,
      error: "No pudimos verificar que este pedido sea tuyo.",
      code: "FORBIDDEN",
      retryRequiresEmail: true,
    };
  }

  const backUrl = buildAlbumOrderFailureBackUrl(order.origin, order.album?.publicSlug);

  return {
    ok: true,
    context: {
      orderId: order.id,
      orderType: "ALBUM_ORDER",
      total: order.totalCents,
      albumTitle: order.album?.title ?? null,
      albumSlug: order.album?.publicSlug ?? null,
      orderStatus: order.status,
      canRetry: albumOrderCanRetryPayment(order),
      backUrl,
      isPreventaPack: order.origin === OrderOrigin.PREVENTA_PACK,
    },
  };
}

export async function retryAlbumOrderPayment(
  orderId: number,
  authUser: AuthUser | null,
  buyerEmailInput?: string | null,
  options?: { forceRegenerate?: boolean }
): Promise<
  | { ok: true; initPoint: string; reused: boolean }
  | { ok: false; httpStatus: number; error: string; code?: string; retryRequiresEmail?: boolean }
> {
  const order = await loadAlbumOrderForRecovery(orderId);
  if (!order) {
    return { ok: false, httpStatus: 404, error: "Pedido no encontrado" };
  }

  if (!SUPPORTED_ORIGINS.includes(order.origin)) {
    return {
      ok: false,
      httpStatus: 400,
      error: "Este tipo de pedido no admite reintento de pago.",
      code: "UNSUPPORTED_ORDER",
    };
  }

  if (!buyerCanAccessAlbumOrder(order, authUser, buyerEmailInput)) {
    return {
      ok: false,
      httpStatus: 403,
      error: "No pudimos verificar que este pedido sea tuyo.",
      code: "FORBIDDEN",
      retryRequiresEmail: true,
    };
  }

  if (!albumOrderCanRetryPayment(order)) {
    const code =
      order.status === "PAID"
        ? "ALREADY_PAID"
        : order.isTest
          ? "SIMULATED_ORDER"
          : "NOT_RETRYABLE";
    return {
      ok: false,
      httpStatus: 409,
      error:
        order.status === "PAID"
          ? "Este pedido ya fue pagado."
          : "Este pedido no admite reintento de pago.",
      code,
    };
  }

  const pref = await ensureAlbumOrderMpPreference(orderId, {
    forceRegenerate: options?.forceRegenerate,
  });

  if (!pref.ok) {
    return {
      ok: false,
      httpStatus: pref.httpStatus,
      error: pref.error,
      code: pref.code,
    };
  }

  return { ok: true, initPoint: pref.initPoint, reused: pref.reused };
}
