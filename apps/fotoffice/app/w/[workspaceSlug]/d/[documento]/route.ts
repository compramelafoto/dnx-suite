import { after, type NextRequest } from "next/server";
import { documentoPublico, enlaceParaVer, sumarDescarga } from "@/lib/website/documentos.server";
import { esBot, esPrefetch } from "@/lib/website/visitas";

/**
 * El enlace público de un documento del sitio: `/w/<slug>/d/<documento>` (en el dominio propio,
 * `/d/<documento>`, que el proxy reescribe acá). Si el documento existe y está publicado, suma
 * una descarga y manda al PDF con un enlace firmado de minutos, que el navegador muestra
 * (`Content-Type: application/pdf`, `Content-Disposition: inline`). Si no, «no encontrado».
 *
 * Las vistas previas de WhatsApp, buscadores y precargas no suman descargas.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ workspaceSlug: string; documento: string }> };

function noEncontrado(): Response {
  return new Response("No encontramos este documento. Puede que lo hayan quitado del sitio.", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const { workspaceSlug, documento } = await params;
  const doc = await documentoPublico(workspaceSlug, documento.toLowerCase()).catch((err: unknown) => {
    console.error("[fotoffice][sitio-documentos] no se pudo leer el documento:", err);
    return null;
  });
  if (!doc) return noEncontrado();

  let destino: string;
  try {
    destino = await enlaceParaVer(doc);
  } catch (err) {
    console.error("[fotoffice][sitio-documentos] no se pudo firmar el enlace:", err);
    return new Response("No pudimos abrir el documento. Probá de nuevo en un rato.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  if (!esBot(req.headers.get("user-agent")) && !esPrefetch(req.headers)) {
    after(() => sumarDescarga(doc.workspaceId, doc.id));
  }
  return new Response(null, {
    status: 302,
    headers: { Location: destino, "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}
