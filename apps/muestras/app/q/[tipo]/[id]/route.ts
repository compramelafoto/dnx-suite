import { esDelEquipo } from "@/lib/equipo/permisos";
import { pedidoContable, sumarUno } from "@/lib/estadisticas/contar";
import { destinoDelQr } from "@/lib/estadisticas/qr";
import { frenarPorIp, ipDeLaPeticion } from "@/lib/limite";
import { llaveDeMuestra } from "@/lib/sala/llave";
import { rutaDeSuma } from "@/lib/sala/pase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ tipo: string; id: string }> };

/**
 * 302 sin caché: cada escaneo vuelve a pasar por acá (decisión D12). `Location` relativa: detrás
 * del proxy, `req.url` puede traer un host interno.
 */
function redirigir(path: string) {
  return new Response(null, { status: 302, headers: { Location: path, "Cache-Control": "private, no-store" } });
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
    // El pase lo suma la sala (spec D30): la cookie vive en `/m/<slug>/sala` y acá no llega. `/q`
    // firma el escaneo y manda a la sala, que suma la obra al pase y lleva a la vista de sala.
    try {
      const llave = await llaveDeMuestra(destino.activityId);
      return redirigir(rutaDeSuma({ slug: destino.pase.slug, activityId: destino.activityId, workId: destino.workId, llave, ahora: new Date() }));
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
