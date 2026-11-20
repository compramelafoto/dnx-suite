import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Código del QR de entrega para los pedidos de canje (packs cobrados por fuera, con librito o con
 * copias sueltas). Los pedidos de la tienda escolar ya tienen el suyo guardado en el ítem
 * (`fulfillmentQrToken`); éstos no tienen dónde guardarlo, así que el código es el número del
 * pedido firmado: "c4801.3f9a…". Nadie puede inventar el de otro pedido sin el secreto, y el QR es
 * siempre el mismo aunque se reimprima la etiqueta.
 */

const PREFIJO = "c";
const LARGO_FIRMA = 20;

/**
 * Secreto para firmar; null si no hay ninguno configurado (entonces no hay QR para canjes).
 * Ojo: si se cambia, los QR ya impresos dejan de abrir (se reimprimen las etiquetas).
 */
export function secretoDeEntrega(env: NodeJS.ProcessEnv = process.env): string | null {
  const s = env.SCHOOL_DELIVERY_QR_SECRET || env.CRON_SECRET || "";
  return s.trim() ? s : null;
}

function firma(orderId: number, secreto: string): string {
  return createHmac("sha256", secreto).update(`entrega-canje:${orderId}`).digest("base64url").slice(0, LARGO_FIRMA);
}

export function codigoDeCanje(orderId: number, secreto: string): string {
  return `${PREFIJO}${orderId}.${firma(orderId, secreto)}`;
}

/** El número de pedido de un código de canje válido; null si no es uno o la firma no coincide. */
export function leerCodigoDeCanje(codigo: string, secreto: string): number | null {
  const m = /^c(\d{1,10})\.([A-Za-z0-9_-]+)$/.exec(codigo.trim());
  if (!m) return null;
  const orderId = Number(m[1]);
  if (!Number.isSafeInteger(orderId) || orderId <= 0) return null;
  const esperada = Buffer.from(firma(orderId, secreto));
  const recibida = Buffer.from(m[2]!);
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return null;
  return orderId;
}
