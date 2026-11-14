import { FUNNEL_EVENTS, type FunnelEventName } from "@/lib/funnel-events";

/**
 * Píxel de Meta (Facebook/Instagram Ads) de ComprameLaFoto.
 *
 * El identificador vive en NEXT_PUBLIC_META_PIXEL_ID. Sin esa variable no se carga nada:
 * ni el script de Meta ni los eventos. Así local, las previews y cualquier entorno sin
 * configurar quedan sin píxel.
 */

type MetaStandardEvent = "PageView" | "ViewContent" | "InitiateCheckout" | "AddPaymentInfo" | "Purchase" | "Lead";

type FbqFn = ((...args: unknown[]) => void) & { callMethod?: unknown; queue?: unknown[] };

declare global {
  interface Window {
    fbq?: FbqFn;
  }
}

export function getMetaPixelId(): string | null {
  const raw = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim();
  return raw && /^\d{5,20}$/.test(raw) ? raw : null;
}

/** Zonas privadas (paneles internos) donde no se mide nada. */
const PRIVATE_PREFIXES = ["/admin", "/dashboard", "/fotografo", "/organizador", "/lab", "/cliente", "/cuenta"];

export function isMetaPixelPathAllowed(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return !PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Qué evento estándar de Meta corresponde a cada paso del embudo interno. */
const FUNNEL_TO_META: Partial<Record<FunnelEventName, MetaStandardEvent>> = {
  [FUNNEL_EVENTS.ORDER_CONFIG_VIEW]: "ViewContent",
  [FUNNEL_EVENTS.ORDER_FINAL_VIEW]: "InitiateCheckout",
  [FUNNEL_EVENTS.PAYMENT_START]: "AddPaymentInfo",
};

export function metaEventForFunnel(event: FunnelEventName): MetaStandardEvent | null {
  return FUNNEL_TO_META[event] ?? null;
}

export function metaTrack(
  event: MetaStandardEvent,
  params?: Record<string, unknown>,
  eventId?: string
): void {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  if (!getMetaPixelId()) return;
  try {
    if (eventId) window.fbq("track", event, params ?? {}, { eventID: eventId });
    else window.fbq("track", event, params ?? {});
  } catch {
    // nunca romper la página por la medición
  }
}

/**
 * Compra aprobada. Se manda una sola vez por pedido aunque la persona recargue la página
 * de éxito: el pedido queda anotado en sessionStorage.
 */
export function metaTrackPurchase(input: {
  orderType: string;
  orderId: number;
  value: number | null | undefined;
  currency: string | null | undefined;
}): void {
  if (!Number.isFinite(input.orderId) || input.orderId <= 0) return;
  const key = `cmlf_meta_purchase_${input.orderType}_${input.orderId}`;
  try {
    if (window.sessionStorage.getItem(key)) return;
  } catch {
    /* sin storage: se manda igual */
  }
  const value = typeof input.value === "number" && Number.isFinite(input.value) ? input.value : undefined;
  metaTrack(
    "Purchase",
    {
      ...(value != null ? { value } : {}),
      currency: (input.currency || "ARS").toUpperCase(),
      content_type: "product",
      order_type: input.orderType,
    },
    `purchase-${input.orderType}-${input.orderId}`
  );
  try {
    window.sessionStorage.setItem(key, "1");
  } catch {
    /* ignorar */
  }
}
