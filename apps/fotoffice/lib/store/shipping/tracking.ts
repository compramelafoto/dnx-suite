/**
 * El número de seguimiento que carga el personal al despachar, y el enlace para seguirlo.
 * Módulo PURO.
 */

const MAX = 60;
const FORMA = /^[A-Za-z0-9-]+$/;
export const TRACKING_NUMBER_ERROR = "Revisá el número de seguimiento.";

/** Opcional: vacío es `null`. Si viene, sólo letras, números y guiones, hasta 60. */
export function normalizeTrackingNumber(
  raw: string | null | undefined,
): { ok: true; value: string | null } | { ok: false; error: string } {
  const n = (raw ?? "").trim();
  if (n === "") return { ok: true, value: null };
  if (n.length > MAX || !FORMA.test(n)) return { ok: false, error: TRACKING_NUMBER_ERROR };
  return { ok: true, value: n };
}

/**
 * El enlace de seguimiento, sólo cuando el envío se cotizó con Correo Argentino (con la tabla
 * propia no sabemos qué correo usó la institución).
 *
 * OJO: el formato de esta dirección está sacado del spec y hay que VERIFICARLO EN QA con un envío
 * real. Si no funciona, devolver siempre `null`: los correos y la página muestran sólo el número.
 */
export function trackingUrl(shippingSource: string | null, trackingNumber: string | null): string | null {
  if (shippingSource !== "CORREO_ARGENTINO" || !trackingNumber) return null;
  return `https://www.correoargentino.com.ar/formularios/e-commerce?id=${encodeURIComponent(trackingNumber)}`;
}
