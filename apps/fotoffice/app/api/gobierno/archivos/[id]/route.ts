import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";
import { resolveActiveWorkspace } from "@/lib/workspace";
import { getModuleLevel } from "@/lib/permissions/module-access";
import { hasLevel } from "@/lib/permissions/levels";
import { GOVERNANCE_MODULE_KEY } from "@/lib/governance/constants";
import { signedDownloadUrl } from "@/lib/governance/files";

export const runtime = "nodejs";

/**
 * Descarga de un archivo de un proyecto.
 *
 * Los archivos son privados: esta ruta verifica que quien pide vea los proyectos de ESA
 * institución y recién ahí redirige a un enlace firmado que vence en minutos. La dirección pública
 * del bucket no se usa nunca. (Los socios verán los archivos marcados visibles desde el portal, en
 * la etapa 4, por su propia ruta.)
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();
  const workspace = await resolveActiveWorkspace(user.id);
  if (!workspace) return NextResponse.json({ error: "No hay una institución activa." }, { status: 403 });

  const level = await getModuleLevel(user.id, workspace.id, GOVERNANCE_MODULE_KEY);
  if (!hasLevel(level, "VIEW")) return NextResponse.json({ error: "No tenés acceso a este archivo." }, { status: 403 });

  const archivo = await prisma.govAttachment.findFirst({
    where: { id, workspaceId: workspace.id },
    select: { r2Key: true, filename: true },
  });
  if (!archivo) return NextResponse.json({ error: "Ese archivo no existe." }, { status: 404 });

  const url = await signedDownloadUrl(archivo.r2Key, archivo.filename);
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, no-store" } });
}
