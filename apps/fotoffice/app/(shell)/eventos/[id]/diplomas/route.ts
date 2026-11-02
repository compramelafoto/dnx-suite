import { contextoEventos } from "@/lib/eventos/contexto";
import { emitirDiplomas, nombreDeArchivo } from "@/lib/eventos/diploma";
import { listarInscriptos, obtenerEvento } from "@/lib/eventos/servidor";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Los diplomas del evento en un PDF (uno por página), o el de una persona con `?inscripto=<id>`.
 * `?ver=1` lo abre en el navegador en vez de bajarlo.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await contextoEventos("VIEW");
  if (!ctx) return new Response("No tenés permiso.", { status: 403 });
  const { id } = await params;
  const url = new URL(req.url);
  const uno = url.searchParams.get("inscripto");
  const evento = await obtenerEvento(ctx.workspaceId, id);
  if (!evento) return new Response("No existe el evento.", { status: 404 });

  const todos = await listarInscriptos(ctx.workspaceId, id);
  const elegidos = uno ? todos.filter((i) => i.id === uno) : todos.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const r = await emitirDiplomas({
    workspaceId: ctx.workspaceId,
    eventoId: id,
    inscriptos: elegidos,
    nombreArchivo: nombreDeArchivo("diplomas", evento.nombre, uno && elegidos[0] ? elegidos[0].nombre : ""),
  });
  if (!r.ok) return new Response(r.error, { status: r.status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  return new Response(Buffer.from(r.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${url.searchParams.get("ver") ? "inline" : "attachment"}; filename="${r.nombreArchivo}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
