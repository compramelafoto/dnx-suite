"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";
import { requireOwnWorkspace } from "@/lib/entrada/require-own-workspace";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";
import { isShowcaseMode } from "@/lib/contests/showcase";

const AQUI = "/workspace/configuracion/concursos";

/** Guarda cómo muestra esta institución la vitrina de concursos. Mismo permiso que Configuración. */
export async function saveShowcaseAction(fd: FormData): Promise<void> {
  const user = await requireAuth();
  const ensured = await requireOwnWorkspace(user);
  const m = await prisma.workspaceMembership.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId: ensured.workspaceId } },
    select: { role: true },
  });
  if (!m || !canManageWorkspaceSettings(m.role)) {
    redirect(`${AQUI}?error=${encodeURIComponent("No tenés permiso para cambiar la configuración.")}`);
  }
  const mode = String(fd.get("mode") ?? "ALL");
  if (!isShowcaseMode(mode)) redirect(`${AQUI}?error=${encodeURIComponent("Esa opción no existe.")}`);
  const pedidas = [...new Set(fd.getAll("organizationIds").map(String))].slice(0, 20);
  // Sólo organizaciones que existen: un id inventado no se guarda.
  const validas = pedidas.length
    ? (await prisma.contestOrganization.findMany({ where: { id: { in: pedidas } }, select: { id: true } })).map((o) => o.id)
    : [];
  if (mode === "OWN" && validas.length === 0) {
    redirect(`${AQUI}?error=${encodeURIComponent("Para mostrar sólo los tuyos, marcá al menos una organización.")}`);
  }
  const data = { mode, organizationIds: validas, includeClickaton: fd.get("includeClickaton") === "on" };
  await prisma.workspaceContestShowcase.upsert({
    where: { workspaceId: ensured.workspaceId },
    create: { workspaceId: ensured.workspaceId, ...data },
    update: data,
  });
  revalidatePath(AQUI);
  revalidatePath("/portal");
  redirect(`${AQUI}?ok=1`);
}
