import type { NextRequest } from "next/server";
import { contextoDeContratos } from "@/lib/contratos/contexto";
import { noEncontrado, pdfParaDescargar, respuestaPdf } from "@/lib/contratos/descarga";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * El PDF sellado de un contrato firmado, para el equipo. Hace falta sesión, el módulo Contratos
 * encendido y "Ver"; el workspace sale de la sesión y el contrato tiene que ser de ese workspace. Todo
 * lo demás (sin sesión, sin permiso, otro workspace, sin PDF todavía) es el mismo 404.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await contextoDeContratos("ver");
  if (!ctx) return noEncontrado();
  const { id } = await params;
  if (typeof id !== "string" || id.length === 0 || id.length > 64) return noEncontrado();
  const r = await pdfParaDescargar(ctx.workspaceId, id);
  return r.ok ? respuestaPdf(r.bytes, r.nombre) : noEncontrado();
}
