import { prisma } from "@repo/db";
import { contextoEventos } from "@/lib/eventos/contexto";
import { renderPlacaBienvenida } from "@/lib/eventos/placa";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** La placa de bienvenida de un inscripto, desde el panel (`?inscripto=`). `?descargar=1` la baja. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await contextoEventos("VIEW");
  if (!ctx) return new Response("Sin permiso.", { status: 403 });
  const { id } = await params;
  const url = new URL(req.url);
  const inscriptoId = url.searchParams.get("inscripto") ?? "";
  const ok = await prisma.fotofficeEventoInscripto.findFirst({ where: { id: inscriptoId, eventoId: id, workspaceId: ctx.workspaceId }, select: { id: true } });
  if (!ok) return new Response("No existe.", { status: 404 });
  const r = await renderPlacaBienvenida(ctx.workspaceId, inscriptoId);
  if (!r.ok) return new Response(r.error, { status: 422, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  return new Response(Buffer.from(r.png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `${url.searchParams.get("descargar") ? "attachment" : "inline"}; filename="${r.nombreArchivo}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
