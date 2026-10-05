import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";
import { resolveActiveWorkspace } from "@/lib/workspace";
import { getModuleLevel } from "@/lib/permissions/module-access";
import { hasLevel } from "@/lib/permissions/levels";
import { isFotofficeR2Configured } from "@/lib/images/r2-client";
import { GOVERNANCE_MAX_FILE_BYTES, GOVERNANCE_MODULE_KEY } from "@/lib/governance/constants";
import { createGovernanceUploadUrl } from "@/lib/governance/files";

export const runtime = "nodejs";

/**
 * Dónde subir un archivo de un proyecto de la comisión.
 *
 * **El archivo no pasa por acá**: se devuelve un permiso de escritura de un minuto y el navegador
 * sube directo al bucket, igual que el portfolio. Lo que decide este endpoint, y el cliente no
 * puede torcer: la institución (sale de la sesión), el proyecto (tiene que ser de esa institución)
 * y quién puede subir — quien gestiona proyectos, o el responsable de la tarea si el archivo va en
 * un avance.
 */
export async function POST(request: Request) {
  const user = await requireAuth();
  const workspace = await resolveActiveWorkspace(user.id);
  if (!workspace) return NextResponse.json({ error: "No hay una institución activa." }, { status: 403 });

  const level = await getModuleLevel(user.id, workspace.id, GOVERNANCE_MODULE_KEY);
  if (!hasLevel(level, "VIEW")) return NextResponse.json({ error: "No tenés acceso a proyectos." }, { status: 403 });

  if (!isFotofficeR2Configured()) {
    return NextResponse.json(
      { error: "El almacenamiento de archivos no está configurado. Avisale a la administración." },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    projectId?: string;
    taskId?: string;
    filename?: string;
    contentType?: string;
    size?: number;
  };
  const projectId = String(body.projectId ?? "");
  const proyecto = await prisma.govProject.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
    select: { id: true },
  });
  if (!proyecto) return NextResponse.json({ error: "Ese proyecto no existe." }, { status: 404 });

  if (!hasLevel(level, "MANAGE")) {
    // Quien sólo ve, sube únicamente en un avance de una tarea suya.
    const taskId = String(body.taskId ?? "");
    const tarea = taskId
      ? await prisma.govProjectTask.findFirst({
          where: { id: taskId, projectId: proyecto.id },
          select: { assignee: { select: { userId: true } } },
        })
      : null;
    if (!tarea || tarea.assignee?.userId !== user.id) {
      return NextResponse.json({ error: "Sólo el responsable de la tarea o quien gestiona proyectos sube archivos." }, { status: 403 });
    }
  }

  // El tamaño declarado sirve para avisar antes de subir; el real se verifica al registrar.
  if (typeof body.size === "number" && body.size > GOVERNANCE_MAX_FILE_BYTES) {
    return NextResponse.json({ error: "El archivo supera el máximo de 25 MB." }, { status: 400 });
  }

  try {
    const r = await createGovernanceUploadUrl({
      workspaceId: workspace.id,
      projectId: proyecto.id,
      filename: String(body.filename ?? ""),
      contentType: String(body.contentType ?? ""),
    });
    return NextResponse.json(r, { status: 200 });
  } catch {
    return NextResponse.json({ error: "No pudimos preparar la subida. Probá de nuevo." }, { status: 400 });
  }
}
