import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { isFotofficeR2Configured } from "@/lib/images/r2-client";
import { GOVERNANCE_MAX_FILE_BYTES } from "@/lib/governance/constants";
import { createGovernanceUploadUrl } from "@/lib/governance/files";
import { loadPortalGovernance } from "@/lib/governance/portal-access";

export const runtime = "nodejs";

/**
 * Dónde sube un archivo el socio. Dos casos y ninguno más:
 * - su propia propuesta, mientras espera respuesta de la comisión;
 * - un avance de una tarea que le asignaron.
 * Igual que en el panel, el archivo no pasa por acá: se firma una escritura de un minuto.
 */
export async function POST(request: Request) {
  const ctx = await loadPortalGovernance();
  if (!ctx) return NextResponse.json({ error: "No tenés acceso a proyectos." }, { status: 403 });
  if (!isFotofficeR2Configured()) {
    return NextResponse.json({ error: "El almacenamiento de archivos no está configurado." }, { status: 503 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    projectId?: string;
    taskId?: string;
    filename?: string;
    contentType?: string;
    size?: number;
  };
  const projectId = String(body.projectId ?? "");
  const taskId = String(body.taskId ?? "");

  const permitido = taskId
    ? await prisma.govProjectTask.count({
        where: { id: taskId, projectId, assigneeMemberId: ctx.member.id, project: { workspaceId: ctx.workspace.id } },
      })
    : await prisma.govProject.count({
        where: { id: projectId, workspaceId: ctx.workspace.id, proposedByMemberId: ctx.member.id, status: "MEMBER_PROPOSAL" },
      });
  if (permitido === 0) return NextResponse.json({ error: "Acá no podés subir archivos." }, { status: 403 });

  if (typeof body.size === "number" && body.size > GOVERNANCE_MAX_FILE_BYTES) {
    return NextResponse.json({ error: "El archivo supera el máximo de 25 MB." }, { status: 400 });
  }
  try {
    const r = await createGovernanceUploadUrl({
      workspaceId: ctx.workspace.id,
      projectId,
      filename: String(body.filename ?? ""),
      contentType: String(body.contentType ?? ""),
    });
    return NextResponse.json(r, { status: 200 });
  } catch {
    return NextResponse.json({ error: "No pudimos preparar la subida. Probá de nuevo." }, { status: 400 });
  }
}
