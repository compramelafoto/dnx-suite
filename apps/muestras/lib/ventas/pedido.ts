import "server-only";
import { createHash, createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "@repo/db";
import { isSalePublicId } from "@repo/muestras";
import { credencialesDeVentas } from "./config";

export { COOKIE_PEDIDO_DIAS, cookieDePedido, nombreCookieDePedido } from "./cookie-pedido";

/**
 * El pedido del comprador sin cuenta (etapa 8, spec D25): un `publicId` opaco y un token HMAC con
 * `MUESTRAS_PEDIDOS_SECRET` (se guarda sólo su hash). Con el enlace `?t=` o la cookie del pedido se
 * vuelve a él. Toda comparación es en tiempo constante.
 */
const ALFABETO = "abcdefghijklmnopqrstuvwxyz0123456789";

export function nuevoPublicId(): string {
  return Array.from({ length: 16 }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");
}

function secreto(): string {
  const s = credencialesDeVentas().pedidosSecret;
  if (!s) throw new Error("Falta MUESTRAS_PEDIDOS_SECRET.");
  return s;
}

/** HMAC-SHA256(secreto, publicId) en base64url. */
export function tokenDePedido(publicId: string, clave: string = secreto()): string {
  return createHmac("sha256", clave).update(publicId).digest("base64url");
}

/** Lo que se guarda en la base (`accessTokenHash`): nunca el token. */
export function hashDeToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function iguales(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * ¿Este token abre este pedido? Se compara su hash con el guardado (así un cambio del secreto no
 * rompe los enlaces que ya tienen los compradores).
 */
export function tokenValido(token: string | null | undefined, accessTokenHash: string): boolean {
  if (typeof token !== "string" || token.length < 20 || token.length > 100) return false;
  return iguales(hashDeToken(token), accessTokenHash);
}

/** El pedido, si el token del enlace o el de la cookie lo abren; si no, `null`. */
export async function pedidoConAcceso(publicId: string, acceso: { token?: string | null; cookie?: string | null }) {
  if (!isSalePublicId(publicId)) return null;
  const pedido = await prisma.culturalSaleOrder.findUnique({ where: { publicId } });
  if (!pedido) return null;
  const ok = tokenValido(acceso.token, pedido.accessTokenHash) || tokenValido(acceso.cookie, pedido.accessTokenHash);
  return ok ? pedido : null;
}
