import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { archivoDeMensaje, claveDeMedia } from "@/lib/bandeja/archivo-de-mensaje";
import { requireBandeja } from "@/lib/bandeja/pagina";
import { urlDeLecturaArchivo } from "@/lib/carpetas/almacen";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Foto o archivo que mandó un cliente por WhatsApp (etapa 2 del bot). Con permiso de "Ver" en la
 * Bandeja redirige a una URL firmada del R2 privado; `?modo=descargar` la baja, si no se mira.
 */
export async function GET(request: Request, { params }: { params: Promise<{ mensajeId: string }> }) {
  const { ctx } = await requireBandeja();
  const { mensajeId } = await params;
  const m = (await prisma.fotofficeWaMensaje.findFirst({
    where: { id: mensajeId, workspaceId: ctx.workspaceId },
    select: { tipo: true, media: true },
  })) as { tipo: string; media: unknown } | null;
  const clave = m ? claveDeMedia(m.media) : null;
  const archivo = m ? archivoDeMensaje(m.tipo, m.media) : null;
  if (!clave || !archivo) return NextResponse.json({ error: "no encontrado" }, { status: 404, headers: { "Cache-Control": "private, no-store" } });

  const modo = new URL(request.url).searchParams.get("modo") === "descargar" ? "descargar" : "ver";
  const url = await urlDeLecturaArchivo(clave, archivo.nombre, modo);
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, no-store" } });
}
