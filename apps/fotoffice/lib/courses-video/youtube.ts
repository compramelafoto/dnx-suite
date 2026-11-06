/**
 * Clases de cursos gratuitos alojadas en YouTube.
 *
 * Un curso grabado sin precio es gratuito: cualquiera mira todas sus clases sin registrarse.
 * Como no hay nada que proteger, el video puede vivir en YouTube y no ocupa lugar ni minutos
 * de Cloudflare Stream. En un curso pago no se permite: un video de YouTube se comparte con
 * copiar el enlace, y el que pagó estaría pagando algo que circula gratis.
 */
import { idDeYoutube } from "@/lib/tutoriales/curso";

export const PROVEEDOR_YOUTUBE = "youtube";
export const PROVEEDOR_STREAM = "cloudflare_stream";

/** Los IDs de YouTube son siempre 11 caracteres de este alfabeto. */
const ID_VALIDO = /^[A-Za-z0-9_-]{11}$/;

export type EnlaceDeYoutube = { ok: true; id: string } | { ok: false; error: string };

export function leerEnlaceDeYoutube(entrada: string): EnlaceDeYoutube {
  const texto = entrada.trim();
  if (!texto) return { ok: false, error: "Pegá el enlace del video de YouTube." };
  const id = idDeYoutube(texto);
  if (!id || !ID_VALIDO.test(id)) {
    return {
      ok: false,
      error: "Ese enlace no es de un video de YouTube. Copialo desde «Compartir» en el video.",
    };
  }
  return { ok: true, id };
}

/** Un curso es gratuito cuando es grabado y no tiene precio (vacío o cero). */
export function esCursoGratuito(curso: {
  deliveryMode: string;
  priceArs: { toString(): string } | string | number | null;
}): boolean {
  if (curso.deliveryMode !== "RECORDED") return false;
  if (curso.priceArs === null || curso.priceArs === undefined) return true;
  const n = Number(curso.priceArs.toString());
  return !Number.isFinite(n) || n <= 0;
}

/** Reproductor de YouTube sin cookies de seguimiento hasta que se aprieta play. */
export function urlDeInsercionDeYoutube(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`;
}

export function miniaturaDeYoutube(id: string): string {
  return `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
}
