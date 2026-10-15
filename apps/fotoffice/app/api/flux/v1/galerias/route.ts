import { autorizarFlux, enlaceDeEstudio, falloFlux, galeriaDeEntregaParaProyecto, leerJson, MENSAJES_FLUX, respuestaJson } from "@/lib/galerias/flux";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** DNX FLUX: crea (o devuelve, una por proyecto) la galería de entrega del proyecto. */
export async function POST(request: Request) {
  const a = await autorizarFlux(request);
  if ("respuesta" in a) return a.respuesta;
  const cuerpo = await leerJson(request);
  if (!cuerpo) return falloFlux(MENSAJES_FLUX.datos, 400);
  try {
    const r = await galeriaDeEntregaParaProyecto(a.ctx, cuerpo.proyectoId, cuerpo.nombre);
    if (!r.ok) return falloFlux(r.error, r.status);
    return respuestaJson({ galeria: { id: r.id, enlaceEstudio: enlaceDeEstudio(request, r.id) } });
  } catch {
    return falloFlux(MENSAJES_FLUX.error, 503);
  }
}
