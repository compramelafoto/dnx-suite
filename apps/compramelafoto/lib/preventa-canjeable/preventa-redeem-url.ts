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

export function parsePreCompraOrderIdFromPaymentRef(
  preCompraPaymentRef: string | null | undefined
): number | null {
  if (preCompraPaymentRef == null) return null;
  const n = Number.parseInt(String(preCompraPaymentRef).trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}
