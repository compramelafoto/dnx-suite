"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { actorLabel, requireGovernanceViewer } from "@/lib/governance/access";
import { canWithdrawComment, parseCommentBody } from "@/lib/governance/comments";

/**
 * Opiniones de la comisión sobre un proyecto. Opina cualquiera que vea Gobierno, aunque no vote:
 * una opinión no cuenta para nada, sólo se lee antes y durante la reunión.
 */

const detalle = (id: string) => `/gobierno/${id}`;

function conError(destino: string, error: string): never {
  redirect(`${destino}?error=${encodeURIComponent(error)}#opiniones`);
}

export async function addCommentAction(fd: FormData): Promise<void> {
  const { workspace, user } = await requireGovernanceViewer();
  const projectId = String(fd.get("projectId") ?? "").trim();
  const proyecto = await prisma.govProject.findFirst({ where: { id: projectId, workspaceId: workspace.id }, select: { id: true } });
  if (!proyecto) conError("/gobierno", "Ese proyecto no existe.");
  const parsed = parseCommentBody(fd.get("body"));
  if (!parsed.ok) conError(detalle(projectId), parsed.error);

  await prisma.govComment.create({
    data: { projectId: proyecto.id, authorUserId: user.id, authorLabel: actorLabel(user), body: parsed.body },
  });
  revalidatePath(detalle(projectId));
  redirect(`${detalle(projectId)}#opiniones`);
}

export async function withdrawCommentAction(fd: FormData): Promise<void> {
  const { workspace, user } = await requireGovernanceViewer();
  const commentId = String(fd.get("commentId") ?? "").trim();
  const comentario = await prisma.govComment.findFirst({
    where: { id: commentId, project: { workspaceId: workspace.id } },
    select: { id: true, projectId: true, authorUserId: true, withdrawnAt: true },
  });
  if (!comentario) conError("/gobierno", "Esa opinión no existe.");
  if (!canWithdrawComment(comentario, user.id)) conError(detalle(comentario.projectId), "Sólo quien la escribió la puede retirar.");

  await prisma.govComment.update({ where: { id: comentario.id }, data: { withdrawnAt: new Date() } });
  revalidatePath(detalle(comentario.projectId));
  redirect(`${detalle(comentario.projectId)}#opiniones`);
}
