import { NextResponse } from "next/server";
import { descargaDelLaboratorio } from "@/lib/carpetas/carpeta";
import { workspaceDelSlug } from "@/lib/presupuestos/sitio";

export const dynamic = "force-dynamic";

/**
 * Descarga de un archivo con el enlace del laboratorio: anota en el trabajo que el proveedor bajó
 * los archivos (la primera vez) y redirige a la URL firmada. Los enlaces del cliente no pasan por acá.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ workspaceSlug: string; token: string; archivoId: string }> }) {
  const { workspaceSlug, token, archivoId } = await params;
  const workspaceId = await workspaceDelSlug(workspaceSlug);
  if (!workspaceId) return new NextResponse(null, { status: 404 });
  const url = await descargaDelLaboratorio(workspaceId, token, archivoId);
  if (!url) return new NextResponse("Este enlace ya no es válido.", { status: 404 });
  return NextResponse.redirect(url, 302);
}
