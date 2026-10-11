/**
 * El enlace personal de cada cliente de una galería (etapa 7). Módulo PURO: la clave y el entorno se
 * inyectan. Mismo esquema que el del presupuesto (`lib/presupuestos/enlace.ts`):
 *
 * - El token es HMAC-SHA256(clave de enlaces, "fotoffice-galeria:v1:<galeriaClienteId>:<tokenIssuedAt ISO>")
 *   en base64url (43 caracteres): no se adivina sin la clave y el servidor lo RE-DERIVA cuando el estudio
 *   quiere copiarlo, sin guardarlo en claro.
 * - En la base sólo va su hash SHA-256 en hex (`tokenHash`, único), para buscarlo.
 * - Regenerar = nuevo `tokenIssuedAt` (el token viejo deja de andar porque su hash ya no está);
 *   anular = `revokedAt`.
 */
import { createHmac } from "node:crypto";
import { hashDeToken, resolverClaveDeEnlace, tokenConForma } from "@/lib/presupuestos/enlace";

export { hashDeToken, resolverClaveDeEnlace, tokenConForma };

const PREFIJO = "fotoffice-galeria:v1:";

/** El token de un cliente de galería emitido en `emitidoEn`. */
export function tokenDeGaleriaCliente(galeriaClienteId: string, emitidoEn: Date, clave: string): string {
  return createHmac("sha256", clave).update(`${PREFIJO}${galeriaClienteId}:${emitidoEn.toISOString()}`).digest("base64url");
}

/** Ruta del enlace dentro del sitio de la organización. */
export function rutaDeGaleria(token: string): string {
  return `/galeria/${encodeURIComponent(token)}`;
}

/** Dirección completa: dominio propio conectado o `/w/<slug>` bajo el origen de FOTOFFICE. null si no hay cómo armarla. */
export function urlDeGaleria(input: { customDomain: string | null; appOrigin: string; slug: string | null; token: string }): string | null {
  const ruta = rutaDeGaleria(input.token);
  if (input.customDomain) return `https://${input.customDomain}${ruta}`;
  if (!input.appOrigin || !input.slug) return null;
  return `${input.appOrigin}/w/${encodeURIComponent(input.slug)}${ruta}`;
}
