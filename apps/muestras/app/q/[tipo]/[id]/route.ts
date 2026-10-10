import { ROOM_PASS_HOURS, mergeRoomPass, roomPassCookieName, roomPassValid } from "@repo/muestras";
import { esDelEquipo } from "@/lib/equipo/permisos";
import { pedidoContable, sumarUno } from "@/lib/estadisticas/contar";
import { destinoDelQr } from "@/lib/estadisticas/qr";
import { frenarPorIp, ipDeLaPeticion } from "@/lib/limite";
import { firmarPase, leerPase, llaveDeMuestra } from "@/lib/sala/llave";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ tipo: string; id: string }> };

/**
 * 302 sin caché: cada escaneo vuelve a pasar por acá (decisión D12). `Location` relativa: detrás
 * del proxy, `req.url` puede traer un host interno.
 */
function redirigir(path: string, cookie?: string) {
  const headers = new Headers({ Location: path, "Cache-Control": "private, no-store" });
  if (cookie) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 302, headers });
}

/** El valor de una cookie del pedido (los nombres y valores nuestros no llevan caracteres raros). */
function leerCookie(req: Request, nombre: string): string | null {
  for (const parte of (req.headers.get("cookie") ?? "").split(";")) {
    const i = parte.indexOf("=");
    if (i > 0 && parte.slice(0, i).trim() === nombre) return parte.slice(i + 1).trim();
  }
  return null;
}

/**
 * El pase de sala (spec D30): suma la obra escaneada al pase vigente de esta muestra (si la firma
 * vale, es de esta muestra y no venció; si no, empieza de cero), renueva las 8 horas y lo firma.
 * `HttpOnly` y `SameSite=Lax`; `Secure` siempre en producción (en `next dev` por http, no).
 */
async function cookieDePase(req: Request, activityId: string, workId: string): Promise<string> {
  const llave = await llaveDeMuestra(activityId);
  const nombre = roomPassCookieName(activityId);
  const ahora = new Date();
  // Primero la firma (dentro de `leerPase`), después la muestra y el vencimiento; recién ahí se suma.
  const previo = leerPase(leerCookie(req, nombre), llave);
  const vigente = roomPassValid(previo, activityId, ahora) ? previo : null;
  const valor = firmarPase(mergeRoomPass(vigente, { activityId, workId, now: ahora }), llave);
  const seguro = process.env.NODE_ENV === "production" || new URL(req.url).protocol === "https:";
  return `${nombre}=${valor}; Path=/; Max-Age=${ROOM_PASS_HOURS * 3600}; HttpOnly; SameSite=Lax${seguro ? "; Secure" : ""}`;
}

/** Freno barato antes de consultar la base: pasado el tope, a la portada sin mirar nada. */
const dejaConsultar = (req: Request) => frenarPorIp("qr", ipDeLaPeticion(req.headers)).allowed;

/** QR impreso en fichas, carteles, catálogos y afiches: cuenta el escaneo y lleva a la página. */
export async function GET(req: Request, { params }: Ctx) {
  const { tipo, id } = await params;
  if (!dejaConsultar(req)) return redirigir("/");
  let destino;
  try {
    destino = await destinoDelQr(tipo, id);
  } catch (err) {
    console.error("[q] no se pudo leer el destino:", err instanceof Error ? err.message : String(err));
    return redirigir("/");
  }
  if (!destino) return redirigir("/");
  try {
    if (
      pedidoContable(req.headers) &&
      frenarPorIp("escaneos", ipDeLaPeticion(req.headers)).allowed &&
      frenarPorIp("escaneosPorPagina", ipDeLaPeticion(req.headers), `${destino.activityId}:${destino.workId}`).allowed &&
      !(await esDelEquipo(destino.activityId))
    ) {
      await sumarUno({ activityId: destino.activityId, workId: destino.workId, metric: destino.metric });
    }
  } catch (err) {
    // Contar nunca puede romper un QR impreso.
    console.error("[q] no se pudo contar el escaneo:", err instanceof Error ? err.message : String(err));
  }
  if (destino.pase) {
    try {
      return redirigir(destino.path, await cookieDePase(req, destino.activityId, destino.workId));
    } catch (err) {
      // Sin pase, la vista de sala manda a la página pública: el QR igual lleva a algún lado.
      console.error("[q] no se pudo dar el pase de sala:", err instanceof Error ? err.message : String(err));
    }
  }
  return redirigir(destino.path);
}

/** Algunos lectores de QR preguntan con HEAD antes de abrir: se redirige sin contar ni dar pase. */
export async function HEAD(req: Request, { params }: Ctx) {
  const { tipo, id } = await params;
  if (!dejaConsultar(req)) return redirigir("/");
  const destino = await destinoDelQr(tipo, id).catch(() => null);
  return redirigir(destino?.path ?? "/");
}
