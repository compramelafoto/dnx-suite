import { contextoEventos } from "@/lib/eventos/contexto";
import { planillaInscriptos } from "@/lib/eventos/reglas";
import { listarInscriptos, obtenerEvento } from "@/lib/eventos/servidor";

export const dynamic = "force-dynamic";

/** La planilla de inscriptos del evento (CSV con punto y coma, se abre directo en Excel). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await contextoEventos("VIEW");
  if (!ctx) return new Response("No tenés permiso.", { status: 403 });
  const { id } = await params;
  const evento = await obtenerEvento(ctx.workspaceId, id);
  if (!evento) return new Response("No existe.", { status: 404 });
  const filas = await listarInscriptos(ctx.workspaceId, id);
  const csv = planillaInscriptos(filas.map((f) => ({ ...f, montoArs: f.montoArs?.toString() ?? null })));
  const nombre = `inscriptos-${evento.nombre}`.normalize("NFD").replace(/[^\w-]+/g, "-").replace(/-+/g, "-").toLowerCase();
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombre}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
