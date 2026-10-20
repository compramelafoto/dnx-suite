import "server-only";
import { ROOM_PASS_HOURS, mergeRoomPass, roomPassCookieName, roomPassValid } from "@repo/muestras";
import { firmarEscaneo, firmarPase, leerPase } from "./llave";

/** La sala de una muestra: el único lugar al que viaja la cookie del pase (spec D30). */
export const rutaDeSala = (slug: string) => `/m/${encodeURIComponent(slug)}/sala`;

/** El valor de una cookie del pedido (los nombres y valores nuestros no llevan caracteres raros). */
export function leerCookie(req: Request, nombre: string): string | null {
  for (const parte of (req.headers.get("cookie") ?? "").split(";")) {
    const i = parte.indexOf("=");
    if (i > 0 && parte.slice(0, i).trim() === nombre) return parte.slice(i + 1).trim();
  }
  return null;
}

/**
 * A dónde manda `/q` después de un escaneo de sala: a la sala de la muestra, que recibe la cookie del
 * pase y le suma esta obra. La firma dice que el escaneo pasó por `/q` hace instantes.
 */
export function rutaDeSuma(p: { slug: string; activityId: string; workId: string; llave: string; ahora: Date }): string {
  const ts = p.ahora.getTime();
  const f = firmarEscaneo(p.activityId, p.workId, ts, p.llave);
  return `${rutaDeSala(p.slug)}/sumar/${encodeURIComponent(p.workId)}?t=${ts}&f=${f}`;
}

/**
 * La cookie del pase con esta obra sumada (spec D30): suma al pase vigente de esta muestra (si la
 * firma vale, es de esta muestra y no venció; si no, empieza de cero), renueva las 8 horas y lo firma.
 * `Path` = la sala de la muestra (no viaja al resto del sitio), `HttpOnly` y `SameSite=Lax`; `Secure`
 * siempre en producción (en `next dev` por http, no).
 */
export function cookieDePase(p: {
  previo: string | null; activityId: string; slug: string; workId: string; llave: string; ahora: Date; seguro: boolean;
}): string {
  const nombre = roomPassCookieName(p.activityId);
  // Primero la firma (dentro de `leerPase`), después la muestra y el vencimiento; recién ahí se suma.
  const leido = leerPase(p.previo, p.llave);
  const vigente = roomPassValid(leido, p.activityId, p.ahora) ? leido : null;
  const valor = firmarPase(mergeRoomPass(vigente, { activityId: p.activityId, workId: p.workId, now: p.ahora }), p.llave);
  return `${nombre}=${valor}; Path=${rutaDeSala(p.slug)}; Max-Age=${ROOM_PASS_HOURS * 3600}; HttpOnly; SameSite=Lax${p.seguro ? "; Secure" : ""}`;
}
