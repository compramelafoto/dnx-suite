import { autorizarFlux, estadoDeGaleria, falloFlux, idValido, MENSAJES_FLUX, respuestaJson } from "@/lib/galerias/flux";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** DNX FLUX: estado de la galería y conteos de archivos por estado. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await autorizarFlux(request);
  if ("respuesta" in a) return a.respuesta;
  const { id } = await params;
  if (!idValido(id)) return falloFlux(MENSAJES_FLUX.galeria, 404);
  try {
    const g = await estadoDeGaleria(a.ctx.workspaceId, id);
    if (!g) return falloFlux(MENSAJES_FLUX.galeria, 404);
    return respuestaJson({ galeria: g });
  } catch {
    return falloFlux(MENSAJES_FLUX.error, 503);
  }
}
