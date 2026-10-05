import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { signedDownloadUrl } from "@/lib/governance/files";
import { loadPortalGovernance } from "@/lib/governance/portal-access";

export const runtime = "nodejs";

/**
 * Descarga de un archivo desde el portal. El socio baja sólo:
 * - lo que adjuntó a su propia propuesta,
 * - lo que se cargó en los avances de una tarea suya,
 * - lo que la comisión marcó visible, de un proyecto que también es visible.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await loadPortalGovernance();
  if (!ctx) return NextResponse.json({ error: "No tenés acceso a este archivo." }, { status: 403 });

  const archivo = await prisma.govAttachment.findFirst({
    where: {
      id,
      workspaceId: ctx.workspace.id,
      OR: [
        { project: { proposedByMemberId: ctx.member.id } },
        { taskUpdate: { task: { assigneeMemberId: ctx.member.id } } },
        {
          visibleToMembers: true,
          project: { visibleToMembers: true, status: { notIn: ["MEMBER_PROPOSAL", "ARCHIVED"] } },
        },
      ],
    },
    select: { r2Key: true, filename: true },
  });
  if (!archivo) return NextResponse.json({ error: "Ese archivo no existe." }, { status: 404 });
  const url = await signedDownloadUrl(archivo.r2Key, archivo.filename);
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, no-store" } });
}
