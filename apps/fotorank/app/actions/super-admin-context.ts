"use server";

import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { requireAuth } from "../lib/auth";
import {
  clearSuperAdminUiContext,
  setSuperAdminUiContext,
  userIsFotorankSuperAdmin,
  type SuperAdminUiContext,
} from "../lib/fotorank/access/super-admin";
import { routes } from "../lib/routes";

export async function startActAsOrganizerAction(formData: FormData): Promise<void> {
  const user = await requireAuth();
  if (!userIsFotorankSuperAdmin(user)) {
    redirect("/mi-actividad");
  }
  const organizationId = formData.get("organizationId")?.toString()?.trim();
  if (!organizationId) redirect("/super-admin");
  const result = await setSuperAdminUiContext({
    actor: user,
    context: "organizer",
    organizationId,
  });
  if (!result.ok) redirect("/super-admin?error=act-as");
  redirect(result.redirectTo);
}

export async function startActAsUiContextAction(formData: FormData): Promise<void> {
  const user = await requireAuth();
  if (!userIsFotorankSuperAdmin(user)) {
    redirect("/mi-actividad");
  }
  const context = formData.get("context")?.toString()?.trim() as SuperAdminUiContext | undefined;
  const organizationId = formData.get("organizationId")?.toString()?.trim() || null;
  if (!context || !["organizer", "participant", "jury"].includes(context)) {
    redirect("/super-admin?error=act-as");
  }
  const result = await setSuperAdminUiContext({
    actor: user,
    context,
    organizationId,
  });
  if (!result.ok) redirect("/super-admin?error=act-as");
  redirect(result.redirectTo);
}

/** Abre un concurso fijando el contexto org del Super Admin (evita «concurso no existe»). */
export async function openContestAsSuperAdminAction(formData: FormData): Promise<void> {
  const user = await requireAuth();
  if (!userIsFotorankSuperAdmin(user)) {
    redirect("/mi-actividad");
  }
  const contestId = formData.get("contestId")?.toString()?.trim();
  if (!contestId) redirect("/super-admin");

  const contest = await prisma.fotorankContest.findUnique({
    where: { id: contestId },
    select: { id: true, organizationId: true },
  });
  if (!contest) redirect("/super-admin?error=contest-missing");

  const result = await setSuperAdminUiContext({
    actor: user,
    context: "organizer",
    organizationId: contest.organizationId,
  });
  if (!result.ok) redirect("/super-admin?error=act-as");
  redirect(routes.dashboard.concursos.detalle(contest.id));
}

export async function stopActAsOrganizerAction(): Promise<void> {
  const user = await requireAuth();
  await clearSuperAdminUiContext(user);
  redirect("/super-admin");
}
