/** Token de la página de videos. Módulo PURO (usa `node:crypto`: sólo en el servidor). */
import { createHmac } from "node:crypto";
import { hashDeToken } from "@/lib/presupuestos/enlace";

const PREFIJO_TOKEN = "fotoffice-videos:v1:";
/** Cuántas veces se puede renovar el enlace de una entrega (reenviar, copiar enlace). */
export const MAX_GENERACIONES_ENTREGA = 200;

/**
 * Token de la página de videos, con el mismo criterio que el del pedido (`lib/pedidos/enlace.ts`):
 * HMAC-SHA256 con la clave de los enlaces sobre `fotoffice-videos:v1:<entregaId>:<generación>`, en
 * base64url (43 caracteres). En la base sólo queda el hash SHA-256; el servidor lo rearma (para el
 * correo del recordatorio) probando generaciones. Reenviar o "Copiar enlace" pasa a la generación
 * siguiente y el enlace anterior deja de abrir.
 */
export function tokenDeEntrega(entregaId: string, clave: string, generacion: number): string {
  return createHmac("sha256", clave).update(`${PREFIJO_TOKEN}${entregaId}:${generacion}`).digest("base64url");
}

/** La generación del enlace vigente (la que da el hash guardado), o null. */
export function generacionDeEntrega(entregaId: string, hashGuardado: string | null, clave: string): number | null {
  if (!hashGuardado) return null;
  for (let g = 0; g <= MAX_GENERACIONES_ENTREGA; g++) {
    if (hashDeToken(tokenDeEntrega(entregaId, clave, g)) === hashGuardado) return g;
  }
  return null;
}
