import {
  ALBUM_SALES_NOT_READY_API_CODE,
  CHECKOUT_SALES_NOT_READY_MESSAGE,
} from "@/lib/albums/album-sales-readiness";

/** Señales entre galería y checkout para no mostrar falsos errores por timeout. */

export const CHECKOUT_NAV_LANDED_EVENT = "checkout-nav-landed";
export const CHECKOUT_PREPARE_READY_EVENT = "checkout-prepare-ready";

export const CHECKOUT_PREPARE_TIMEOUT_MS = 60_000;

export function checkoutPrepareStorageKey(albumId: string | number) {
  return `album_${albumId}_checkout_prepared`;
}

export function signalCheckoutNavLanded(albumId: string | number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(CHECKOUT_NAV_LANDED_EVENT, { detail: { albumId: String(albumId) } })
  );
}

export function signalCheckoutPrepareReady(albumId: string | number) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(checkoutPrepareStorageKey(albumId), String(Date.now()));
  } catch {
    /* quota / private mode */
  }
  window.dispatchEvent(
    new CustomEvent(CHECKOUT_PREPARE_READY_EVENT, { detail: { albumId: String(albumId) } })
  );
}

export type CheckoutPrepareClientErrorKind =
  | "network"
  | "missing_photos"
  | "sales_not_ready"
  | "server"
  | "timeout"
  | "unknown";

export const CHECKOUT_PREPARE_SALES_NOT_READY_CODE = ALBUM_SALES_NOT_READY_API_CODE;

export function messageForCheckoutPrepareError(kind: CheckoutPrepareClientErrorKind): string {
  switch (kind) {
    case "network":
      return "No pudimos preparar la compra por un problema de conexión. Revisá internet e intentá de nuevo.";
    case "missing_photos":
      return "Algunas fotos ya no están disponibles. Volvé al álbum y actualizá tu selección.";
    case "sales_not_ready":
      return CHECKOUT_SALES_NOT_READY_MESSAGE;
    case "server":
      return "Hubo un error preparando la compra. Intentá nuevamente.";
    case "timeout":
      return "La preparación está tardando más de lo habitual. Si ya ves el carrito, continuá ahí; si no, tocá Reintentar.";
    default:
      return "Hubo un problema preparando tu compra. Por favor intentá nuevamente.";
  }
}

export function classifyOrderPhotosFetchError(params: {
  res?: Response | null;
  message?: string;
  code?: string;
  missingCount?: number;
}): CheckoutPrepareClientErrorKind {
  if (params.code === CHECKOUT_PREPARE_SALES_NOT_READY_CODE) return "sales_not_ready";
  const msg = (params.message || "").toLowerCase();
  if (msg.includes("no está disponible para compra") || msg.includes("venta todavía no")) {
    return "sales_not_ready";
  }
  if (params.missingCount && params.missingCount > 0) return "missing_photos";
  const status = params.res?.status;
  if (status === 404 && params.code !== CHECKOUT_PREPARE_SALES_NOT_READY_CODE) return "missing_photos";
  if (status != null && status >= 500) return "server";
  if (
    msg.includes("failed to fetch") ||
    msg.includes("network") ||
    msg.includes("load failed") ||
    msg.includes("aborted")
  ) {
    return "network";
  }
  if (status === 403) return "sales_not_ready";
  if (status != null && status >= 400 && status < 500) return "missing_photos";
  return "unknown";
}
