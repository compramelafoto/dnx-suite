"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { requirePortalGovernance } from "@/lib/governance/portal-access";
import { canWithdrawComment, parseCommentBody } from "@/lib/governance/comments";
import { isMemberPollOpen, MAX_MEMBER_COMMENTS_PER_PROJECT } from "@/lib/governance/member-pulse";
import { isVoteValue } from "@/lib/governance/votes";

/**
 * El socio opina sobre un proyecto visible: su voto (privado, sólo cuenta en los totales) y su
 * opinión escrita (le llega a la comisión con su nombre). Cada acción vuelve a comprobar que el
 * proyecto sea visible para él; nada se toma del navegador más que el id.
 */

const detalle = (id: string) => `/portal/proyectos/${id}`;

function volver(projectId: string, extra = ""): never {
  redirect(`${detalle(projectId)}${extra}#opinar`);
}

async function proyectoVisible(workspaceId: string, projectId: string) {
  return prisma.govProject.findFirst({
    where: { id: projectId, workspaceId, visibleToMembers: true },
    select: { id: true, status: true, visibleToMembers: true },
  });
}

export async function memberVoteAction(fd: FormData): Promise<void> {
  const { workspace, member } = await requirePortalGovernance();
  const projectId = String(fd.get("projectId") ?? "").trim();
  const p = await proyectoVisible(workspace.id, projectId);
  if (!p) redirect("/portal/proyectos");
  if (!isMemberPollOpen(p)) volver(p.id, `?error=${encodeURIComponent("La votación de este proyecto está cerrada.")}`);
  const valor = String(fd.get("value") ?? "");
  if (!isVoteValue(valor)) volver(p.id);

  await prisma.govMemberVote.upsert({
    where: { projectId_memberId: { projectId: p.id, memberId: member.id } },
    create: { projectId: p.id, memberId: member.id, value: valor },
    update: { value: valor },
  });
  revalidatePath(detalle(p.id));
  volver(p.id, "?ok=voto");
}

export async function memberCommentAction(fd: FormData): Promise<void> {
  const { workspace, member, user, actor } = await requirePortalGovernance();
  const projectId = String(fd.get("projectId") ?? "").trim();
  const p = await proyectoVisible(workspace.id, projectId);
  if (!p) redirect("/portal/proyectos");
  if (!isMemberPollOpen(p)) volver(p.id, `?error=${encodeURIComponent("Este proyecto ya no recibe opiniones.")}`);
  const parsed = parseCommentBody(fd.get("body"));
  if (!parsed.ok) volver(p.id, `?error=${encodeURIComponent(parsed.error)}`);
  const abiertas = await prisma.govComment.count({ where: { projectId: p.id, authorMemberId: member.id, withdrawnAt: null } });
  if (abiertas >= MAX_MEMBER_COMMENTS_PER_PROJECT) {
    volver(p.id, `?error=${encodeURIComponent("Ya dejaste muchas opiniones en este proyecto. Retirá alguna para escribir otra.")}`);
  }

  const numero = member.memberNumber;
  await prisma.govComment.create({
    data: {
      projectId: p.id,
      authorUserId: user.id,
      authorMemberId: member.id,
      authorLabel: numero ? `${actor} (socio ${numero})` : `${actor} (socio)`,
      body: parsed.body,
    },
  });
  revalidatePath(detalle(p.id));
  revalidatePath(`/gobierno/${p.id}`);
  volver(p.id, "?ok=opinion");
}

export async function memberWithdrawCommentAction(fd: FormData): Promise<void> {
  const { workspace, member, user } = await requirePortalGovernance();
  const commentId = String(fd.get("commentId") ?? "").trim();
  const c = await prisma.govComment.findFirst({
    where: { id: commentId, authorMemberId: member.id, project: { workspaceId: workspace.id } },
    select: { id: true, projectId: true, authorUserId: true, withdrawnAt: true },
  });
  if (!c) redirect("/portal/proyectos");
  if (canWithdrawComment(c, user.id)) {
    await prisma.govComment.update({ where: { id: c.id }, data: { withdrawnAt: new Date() } });
    revalidatePath(detalle(c.projectId));
    revalidatePath(`/gobierno/${c.projectId}`);
  }
  volver(c.projectId);
}
