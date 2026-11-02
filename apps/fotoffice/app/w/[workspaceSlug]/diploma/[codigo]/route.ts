import { prisma } from "@repo/db";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { EVENTOS_MODULE_KEY } from "@/lib/eventos/constants";
import { emitirDiplomas, nombreDeArchivo } from "@/lib/eventos/diploma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * El diploma de una persona, por su código de inscripto: el enlace que se le manda al asistente
 * (`/w/<institución>/diploma/<código>`, o `/diploma/<código>` en el dominio propio). Sin sesión:
 * el código de 6 letras es la llave, igual que en la puerta.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ workspaceSlug: string; codigo: string }> }) {
  const { workspaceSlug, codigo } = await params;
  const texto = (msg: string, status: number) => new Response(msg, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  if (!/^[A-Za-z0-9]{6,10}$/.test(codigo)) return texto("Ese diploma no existe.", 404);

  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({ where: { publicSlug: workspaceSlug }, select: { workspaceId: true } });
  if (!branding || !(await isModuleEnabledForWorkspace(branding.workspaceId, EVENTOS_MODULE_KEY))) return texto("Ese diploma no existe.", 404);

  const inscripto = await prisma.fotofficeEventoInscripto.findFirst({
    where: { workspaceId: branding.workspaceId, codigo: codigo.toUpperCase() },
    include: { evento: { select: { nombre: true } } },
  });
  if (!inscripto) return texto("Ese diploma no existe.", 404);

  const r = await emitirDiplomas({
    workspaceId: branding.workspaceId,
    eventoId: inscripto.eventoId,
    inscriptos: [inscripto],
    nombreArchivo: nombreDeArchivo("diploma", inscripto.evento.nombre, inscripto.nombre),
  });
  if (!r.ok) return texto(r.status === 404 ? "Este diploma todavía no está disponible." : "No pudimos generar el diploma. Probá más tarde.", r.status === 404 ? 404 : 503);
  return new Response(Buffer.from(r.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${r.nombreArchivo}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
