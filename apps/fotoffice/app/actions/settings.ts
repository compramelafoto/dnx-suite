"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { z } from "zod";
import { requireCoursesSalesContext } from "@/lib/workspace";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";

/**
 * La comisión de la plataforma NO está acá a propósito: la fija SUPER_ADMIN en
 * `WorkspaceModuleFee`. El dueño del workspace la ve en su configuración pero no puede
 * cambiarla — antes sí podía, y podía ponerla en cero.
 */
const coursesSettingsSchema = z.object({
  defaultCurrency: z.string().min(1).max(8),
  enrollmentCtaLabel: z.string().max(120).optional().nullable(),
});

function emptyToNull(s: string | undefined): string | null {
  const t = s?.trim();
  return t ? t : null;
}

export type SettingsFormState = { error: string | null; ok?: boolean };

export async function updateCoursesSalesSettingsAction(
  _prev: SettingsFormState | undefined,
  formData: FormData,
): Promise<SettingsFormState> {
  const { workspace, user } = await requireCoursesSalesContext();
  const membership = await prisma.workspaceMembership.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
    select: { role: true },
  });
  const legacyMembership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
    select: { role: true },
  });
  const canManageSettings =
    canManageWorkspaceSettings(membership?.role) || canManageWorkspaceSettings(legacyMembership?.role);
  if (!canManageSettings) {
    return { error: "Solo owner/admin del workspace puede editar la configuración de cursos." };
  }

  const raw = {
    defaultCurrency: formData.get("defaultCurrency")?.toString()?.trim() || "ARS",
    enrollmentCtaLabel: emptyToNull(formData.get("enrollmentCtaLabel")?.toString()),
  };

  const parsed = coursesSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const d = parsed.data;

  await prisma.courseSalesWorkspaceSettings.upsert({
    where: { workspaceId: workspace.id },
    update: {
      defaultCurrency: d.defaultCurrency,
      enrollmentCtaLabel: d.enrollmentCtaLabel ?? "Quiero inscribirme",
    },
    create: {
      workspaceId: workspace.id,
      defaultCurrency: d.defaultCurrency,
      enrollmentCtaLabel: d.enrollmentCtaLabel ?? "Quiero inscribirme",
    },
  });

  revalidatePath("/courses/settings");
  revalidatePath("/courses");
  revalidatePath("/w"); // rutas públicas
  return { error: null, ok: true };
}
