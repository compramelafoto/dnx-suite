import { autorizarFlux, proyectosDePedido, respuestaJson, falloFlux, MENSAJES_FLUX } from "@/lib/galerias/flux";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** DNX FLUX: proyectos del pedido `?pedido=<número>`. Sin coincidencias, `{ "proyectos": [] }`. */
export async function GET(request: Request) {
  const a = await autorizarFlux(request);
  if ("respuesta" in a) return a.respuesta;
  try {
    const pedido = new URL(request.url).searchParams.get("pedido");
    return respuestaJson({ proyectos: await proyectosDePedido(a.ctx.workspaceId, pedido) });
  } catch {
    return falloFlux(MENSAJES_FLUX.error, 503);
  }
}
