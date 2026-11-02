import { prisma } from "@repo/db";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { EVENTOS_MODULE_KEY } from "@/lib/eventos/constants";
import { leerEntrada } from "@/lib/eventos/entrada";
import { renderPlacaBienvenida } from "@/lib/eventos/placa";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * La placa de bienvenida del inscripto, en PNG. Con el token de su enlace personal (`?t=`): la
 * placa lleva su foto, así que no se sirve sólo con el código. `?descargar=1` la baja como archivo.
 */
export async function GET(req: Request, { params }: { params: Promise<{ workspaceSlug: string; codigo: string }> }) {
  const { workspaceSlug, codigo } = await params;
  const url = new URL(req.url);
  const texto = (msg: string, status: number) => new Response(msg, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({ where: { publicSlug: workspaceSlug }, select: { workspaceId: true } });
  if (!branding || !(await isModuleEnabledForWorkspace(branding.workspaceId, EVENTOS_MODULE_KEY))) return texto("Esa placa no existe.", 404);
  const entrada = await leerEntrada(branding.workspaceId, codigo, url.searchParams.get("t"));
  if (!entrada || entrada.estadoPago === "ANULADO") return texto("Esa placa no existe.", 404);

  const r = await renderPlacaBienvenida(branding.workspaceId, entrada.id);
  if (!r.ok) return texto("No pudimos generar la placa. Probá más tarde.", 503);
  return new Response(Buffer.from(r.png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `${url.searchParams.get("descargar") ? "attachment" : "inline"}; filename="${r.nombreArchivo}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
