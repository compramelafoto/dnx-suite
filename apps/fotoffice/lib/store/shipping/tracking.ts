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
 * El enlace de seguimiento, sólo cuando el envío se cotizó con Correo Argentino o Andreani (con la
 * tabla propia no sabemos qué correo usó la institución).
 *
 * OJO: el formato de estas direcciones está sacado del spec y del plan y hay que VERIFICARLO EN QA
 * con un envío real de cada correo. Si alguno no funciona, devolver `null` para ese correo: los
 * correos y la página muestran sólo el número.
 */
/** El nombre del correo para el texto del enlace ("Seguilo en …"); `null` sin enlace posible. */
export function trackingCarrierName(shippingSource: string | null): string | null {
  if (shippingSource === "CORREO_ARGENTINO") return "Correo Argentino";
  if (shippingSource === "ANDREANI") return "Andreani";
  return null;
}

export function trackingUrl(shippingSource: string | null, trackingNumber: string | null): string | null {
  if (!trackingNumber) return null;
  if (shippingSource === "CORREO_ARGENTINO") {
    return `https://www.correoargentino.com.ar/formularios/e-commerce?id=${encodeURIComponent(trackingNumber)}`;
  }
  if (shippingSource === "ANDREANI") {
    // VERIFICAR EN QA: la página pública de Andreani lee el número del fragmento (#!/...).
    return `https://www.andreani.com/#!/informacionEnvio/${encodeURIComponent(trackingNumber)}`;
  }
  return null;
}
