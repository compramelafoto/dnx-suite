import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { workspaceDelSlug } from "@/lib/presupuestos/sitio";
import { asegurarMiniatura, proyectoDeTokenCliente } from "@/lib/impresiones/fuentes-servidor";
import { PRINT_ORDERS_MODULE_KEY, TIPOS_IMAGEN } from "@/lib/impresiones/constantes";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { urlDeLecturaArchivo } from "@/lib/carpetas/almacen";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Miniatura de una foto de la carpeta del cliente (se genera la primera vez). Sólo con el enlace del cliente y
 * con el módulo de impresiones encendido (es para elegir copias).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ workspaceSlug: string; token: string; archivoId: string }> }) {
  const { workspaceSlug, token, archivoId } = await params;
  const workspaceId = await workspaceDelSlug(workspaceSlug);
  if (!workspaceId) return new NextResponse(null, { status: 404 });
  if (!(await isModuleEnabledForWorkspace(workspaceId, PRINT_ORDERS_MODULE_KEY))) return new NextResponse(null, { status: 404 });
  const p = await proyectoDeTokenCliente(workspaceId, token);
  if (!p) return new NextResponse(null, { status: 404 });
  const archivo = await prisma.fotofficeArchivoTrabajo.findFirst({
    where: { id: archivoId, workspaceId, proyectoId: p.proyectoId, estado: "LISTO", tipo: { in: [...TIPOS_IMAGEN] } },
    select: { id: true, key: true },
  });
  if (!archivo) return new NextResponse(null, { status: 404 });
  try {
    const m = await asegurarMiniatura(archivo);
    return NextResponse.redirect(await urlDeLecturaArchivo(m.thumbKey, `${archivo.id}.jpg`, "ver"), 302);
  } catch {
    return new NextResponse(null, { status: 422 });
  }
}
