export * from "./types";
export {
  computeAdminConversionAnalytics,
  computePhotographerConversionAnalytics,
  resolvePhotographerAlbumIds,
} from "./compute-metrics";

export function formatConversionArs(amount: number): string {
  return amount.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
}

export function formatConversionPct(value: number): string {
  return `${value.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;
}

export const RECOVERY_REASON_LABELS: Record<
  import("./types").RecoveryReasonKey,
  string
> = {
  same_cart: "Mismo carrito",
  fewer_photos: "Menos fotos",
  product_change: "Cambio de producto",
  complete_change: "Cambio completo",
};

export const UX_FUNNEL_EVENT_LABELS: Record<string, string> = {
  PAYMENT_REDIRECT_PREPARING_SHOWN: "Overlay preparando pago",
  PAYMENT_RETRY_CLICKED: "Reintentar pago",
  PENDING_ORDER_BANNER_CONTINUE_CLICKED: "Banner: continuar pago",
  PENDING_ORDER_BANNER_SHOWN: "Banner: visto",
  PENDING_ORDER_BANNER_DISMISSED: "Banner: descartado",
  PAYMENT_PENDING_STATUS_REFRESHED: "Actualizar estado",
};
