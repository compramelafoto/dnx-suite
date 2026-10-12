import { autorizarFlux, falloFlux, galeriaDeEntrega, leerJson, MENSAJES_FLUX, pedirSubidasDeDispositivo, respuestaJson, validarArchivos } from "@/lib/galerias/flux";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DNX FLUX: pide las subidas de hasta 50 archivos. Devuelve una entrada por archivo, en el mismo orden:
 * `{ yaEstaba: true }` o `{ fotoId, urlSubida }`.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await autorizarFlux(request);
  if ("respuesta" in a) return a.respuesta;
  const { id } = await params;
  const cuerpo = await leerJson(request);
  if (!cuerpo) return falloFlux(MENSAJES_FLUX.datos, 400);
  const v = validarArchivos(cuerpo.archivos);
  if (!v.ok) return falloFlux(v.error, 400);
  try {
    const g = await galeriaDeEntrega(a.ctx.workspaceId, id);
    if (!g) return falloFlux(MENSAJES_FLUX.galeria, 404);
    const r = await pedirSubidasDeDispositivo(a.ctx, g.id, v.archivos);
    if (!r.ok) return falloFlux(r.error, r.status);
    return respuestaJson({ archivos: r.items });
  } catch {
    return falloFlux(MENSAJES_FLUX.error, 503);
  }
}
