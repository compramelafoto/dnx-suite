/**
 * El enlace personal de cada inscripto: su "mi entrada", donde completa sus datos, sube la foto,
 * ve su QR y baja su placa de bienvenida. Módulo PURO: la clave se inyecta.
 *
 * Mismo esquema que los enlaces de las galerías y los presupuestos: el token es
 * HMAC-SHA256(clave, "fotoffice-evento-entrada:v1:<inscriptoId>") en base64url. No se guarda: la
 * dirección lleva el código del inscripto (`/entrada/<código>?t=<token>`) y el servidor re-deriva el
 * token para compararlo.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const PREFIJO = "fotoffice-evento-entrada:v1:";

export function tokenDeEntrada(inscriptoId: string, clave: string): string {
  return createHmac("sha256", clave).update(`${PREFIJO}${inscriptoId}`).digest("base64url");
}

/** ¿El token que vino en la dirección es el de ese inscripto? En tiempo constante. */
export function tokenDeEntradaValido(inscriptoId: string, token: unknown, clave: string): boolean {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const esperado = Buffer.from(tokenDeEntrada(inscriptoId, clave));
  const recibido = Buffer.from(token);
  return esperado.length === recibido.length && timingSafeEqual(esperado, recibido);
}

/** Ruta del enlace dentro del sitio de la institución. */
export function rutaDeEntrada(codigo: string, token: string): string {
  return `/entrada/${encodeURIComponent(codigo)}?t=${encodeURIComponent(token)}`;
}

/** Ruta de la página pública de inscripción de un evento. */
export function rutaDeInscripcion(slugEvento: string): string {
  return `/evento/${encodeURIComponent(slugEvento)}`;
}

/** Dirección completa: dominio propio conectado o `/w/<slug>` bajo el origen de FOTOFFICE. */
export function urlDelSitio(input: { customDomain: string | null; appOrigin: string; slug: string | null; ruta: string }): string | null {
  if (input.customDomain) return `https://${input.customDomain}${input.ruta}`;
  if (!input.appOrigin || !input.slug) return null;
  return `${input.appOrigin}/w/${encodeURIComponent(input.slug)}${input.ruta}`;
}

/** Un slug de evento: minúsculas, números y guiones. */
export function slugDeEvento(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
