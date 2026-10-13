"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { requireActiveWorkspace } from "@/lib/workspace";
import { hasModuleLevel } from "@/lib/permissions/module-access";
import { MEMBERSHIP_DUES_MODULE_KEY } from "@/lib/membership/constants";

const PANTALLA = "/members/cuotas/configuracion";

/**
 * Alta desde el sitio: sin aprobación, con formulario corto y con qué categoría entra la
 * persona. Apagado por defecto: la SFPR revisa cada solicitud con el formulario completo.
 */
export async function saveEnrollmentSettingsAction(formData: FormData): Promise<void> {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");
  if (!(await hasModuleLevel(user.id, workspace.id, MEMBERSHIP_DUES_MODULE_KEY, "MANAGE"))) {
    redirect(`${PANTALLA}?error=${encodeURIComponent("Solo el dueño o un administrador puede cambiar esto.")}`);
  }

  const crudo = String(formData.get("applicationCategoryId") ?? "").trim();
  const categoria = crudo
    ? await prisma.memberCategory.findFirst({ where: { id: crudo, workspaceId: workspace.id }, select: { id: true } })
    : null;
  const datos = {
    autoApproveApplications: formData.get("autoApproveApplications") === "on",
    simpleApplicationForm: formData.get("simpleApplicationForm") === "on",
    applicationCategoryId: categoria?.id ?? null,
  };

  await prisma.membershipDuesSettings.upsert({
    where: { workspaceId: workspace.id },
    create: { workspaceId: workspace.id, ...datos },
    update: datos,
  });

  revalidatePath(PANTALLA);
  redirect(`${PANTALLA}?alta=guardada`);
}
