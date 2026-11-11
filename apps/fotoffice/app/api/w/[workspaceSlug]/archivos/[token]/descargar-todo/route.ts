import { NextResponse } from "next/server";
import { descargarTodoDelLaboratorio } from "@/lib/carpetas/carpeta";
import { workspaceDelSlug } from "@/lib/presupuestos/sitio";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * «Descargar todo» del laboratorio: un único ZIP ordenado (Tamaño > Acabado > Copias > nombre
 * original). Si la carpeta ya tiene el ZIP del pedido para laboratorio, redirige a ése. Anota
 * «descargó» en el trabajo. Sólo con el enlace del laboratorio.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ workspaceSlug: string; token: string }> }) {
  const { workspaceSlug, token } = await params;
  const workspaceId = await workspaceDelSlug(workspaceSlug);
  if (!workspaceId) return new NextResponse(null, { status: 404 });
  const r = await descargarTodoDelLaboratorio(workspaceId, token);
  if (!r) return new NextResponse("Este enlace ya no es válido.", { status: 404 });
  if (r.tipo === "UNO") return NextResponse.redirect(r.url, 302);
  if (r.tipo === "GRANDE") {
    return new NextResponse("La carpeta es muy pesada para un solo ZIP: bajá los archivos de a uno desde la lista.", { status: 413 });
  }
  const flujo = r.flujo;
  const cuerpo = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await flujo.next();
        if (done) controller.close();
        else controller.enqueue(new Uint8Array(value));
      } catch (e) {
        console.error("[carpetas] falló el ZIP de descargar todo", { error: e instanceof Error ? e.message : "desconocido" });
        controller.error(e);
      }
    },
    async cancel() {
      await flujo.return(undefined);
    },
  });
  return new NextResponse(cuerpo, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${r.nombre.replace(/[^A-Za-z0-9._-]/g, "-")}"`,
      "Cache-Control": "no-store",
    },
  });
}
