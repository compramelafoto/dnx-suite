import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Códigos del panel de impresiones. Módulo puro: el secreto llega por parámetro
 * (el que da `secretoDeEntrega()` de `school-fulfillment/codigo-de-canje`).
 *
 * - QR del pedido: "p<id>.<firma>", mismo HMAC que el de canje pero con otro texto y otra letra,
 *   para que un código de canje nunca valga como entrega de un pedido de impresión.
 * - Token del lote: aleatorio, va en el enlace del laboratorio; en la base sólo se guarda su hash.
 */

const PREFIJO = "p";
const LARGO_FIRMA = 20;

function firma(printOrderId: number, secreto: string): string {
  return createHmac("sha256", secreto).update(`entrega-pedido:${printOrderId}`).digest("base64url").slice(0, LARGO_FIRMA);
}

export function codigoDeEntregaDePedido(printOrderId: number, secreto: string): string {
  return `${PREFIJO}${printOrderId}.${firma(printOrderId, secreto)}`;
}

/** El id del pedido de un código válido; null si no lo es o la firma no coincide. */
export function leerCodigoDeEntregaDePedido(codigo: string, secreto: string): number | null {
  const m = /^p(\d{1,10})\.([A-Za-z0-9_-]+)$/.exec(codigo.trim());
  if (!m) return null;
  const id = Number(m[1]);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const esperada = Buffer.from(firma(id, secreto));
  const recibida = Buffer.from(m[2]!);
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return null;
  return id;
}

export function hashDeToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function nuevoTokenDeLote(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashDeToken(token) };
}
