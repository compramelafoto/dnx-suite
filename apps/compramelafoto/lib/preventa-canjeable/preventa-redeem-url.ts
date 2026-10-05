/**
 * URLs canónicas de checkout/canje preventa.
 * Siempre `/a/{albumId}/comprar` — nunca `/album/{slug}/comprar` (redirect legacy aparte).
 */

export function buildPreventaRedeemComprarUrl(opts: {
  albumId: number;
  preventaPackOrderId?: number | null;
  preventaPackToken?: string | null;
  source?: string | null;
}): string {
  const params = new URLSearchParams();
  if (opts.preventaPackOrderId != null && Number.isFinite(opts.preventaPackOrderId)) {
    params.set("preventaPackOrderId", String(opts.preventaPackOrderId));
  }
  const token = opts.preventaPackToken?.trim();
  if (token) params.set("preventaPackToken", token);
  const source = opts.source?.trim();
  if (source) params.set("source", source);
  const qs = params.toString();
  return `/a/${opts.albumId}/comprar${qs ? `?${qs}` : ""}`;
}

/** Pack de preventa que se está canjeando: viaja en la URL de la galería y de la compra. */
export type PreventaRedeemContext = {
  preventaPackOrderId?: number;
  preventaPackToken?: string;
};

type SearchParamsLike = { get(name: string): string | null };

/** Lee el pack a canjear de la URL; `null` si no hay ninguno (compra normal). */
export function readPreventaRedeemParams(
  searchParams: SearchParamsLike | null | undefined
): PreventaRedeemContext | null {
  if (!searchParams) return null;
  const token = searchParams.get("preventaPackToken")?.trim();
  const rawId = searchParams.get("preventaPackOrderId")?.trim();
  const orderId = rawId ? Number.parseInt(rawId, 10) : NaN;
  const ctx: PreventaRedeemContext = {};
  if (token) ctx.preventaPackToken = token;
  if (Number.isFinite(orderId) && orderId > 0) ctx.preventaPackOrderId = orderId;
  return ctx.preventaPackToken || ctx.preventaPackOrderId ? ctx : null;
}

export function appendPreventaRedeemParams(
  params: URLSearchParams,
  ctx: PreventaRedeemContext | null | undefined
): void {
  if (!ctx) return;
  if (ctx.preventaPackOrderId != null) {
    params.set("preventaPackOrderId", String(ctx.preventaPackOrderId));
  }
  if (ctx.preventaPackToken) params.set("preventaPackToken", ctx.preventaPackToken);
}

/**
 * Entrada al canje: la GALERÍA en modo canje, no la página de compra. La compra necesita
 * las fotos elegidas (`photoIds`) y sin ellas cortaba con "No se especificaron fotos para
 * comprar": el botón "Elegir fotos en el álbum" llevaba a esa pantalla de error.
 */
export function buildPreventaRedeemGalleryUrl(opts: {
  albumId: number;
  preventaPackOrderId?: number | null;
  preventaPackToken?: string | null;
}): string {
  const params = new URLSearchParams();
  appendPreventaRedeemParams(params, {
    preventaPackOrderId:
      opts.preventaPackOrderId != null && Number.isFinite(opts.preventaPackOrderId)
        ? opts.preventaPackOrderId
        : undefined,
    preventaPackToken: opts.preventaPackToken?.trim() || undefined,
  });
  const qs = params.toString();
  return `/a/${opts.albumId}${qs ? `?${qs}` : ""}`;
}

export function parsePreCompraOrderIdFromPaymentRef(
  preCompraPaymentRef: string | null | undefined
): number | null {
  if (preCompraPaymentRef == null) return null;
  const n = Number.parseInt(String(preCompraPaymentRef).trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}
