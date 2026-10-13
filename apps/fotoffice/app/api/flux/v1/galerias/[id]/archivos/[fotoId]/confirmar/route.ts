import { autorizarFlux, confirmarArchivoDeDispositivo, falloFlux, galeriaDeEntrega, MENSAJES_FLUX, respuestaJson } from "@/lib/galerias/flux";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Procesar una foto (leer, dos derivadas, dos subidas) entra de sobra en un minuto. */
export const maxDuration = 60;

/** DNX FLUX: confirma que el archivo se subió; una foto se procesa, un video sólo comprueba el tamaño. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string; fotoId: string }> }) {
  const a = await autorizarFlux(request);
  if ("respuesta" in a) return a.respuesta;
  const { id, fotoId } = await params;
  try {
    const g = await galeriaDeEntrega(a.ctx.workspaceId, id);
    if (!g) return falloFlux(MENSAJES_FLUX.galeria, 404);
    const r = await confirmarArchivoDeDispositivo(a.ctx, g.id, fotoId);
    return respuestaJson(r.cuerpo, r.status);
  } catch {
    return falloFlux(MENSAJES_FLUX.error, 503);
  }
}
