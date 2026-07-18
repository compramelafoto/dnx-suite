"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";
import { ensureFotofficeWorkspaceForUser } from "@/lib/ensure-workspace";
import {
  FOTOFFICE_ACTIVITY_TYPES,
  FOTOFFICE_SPECIALTY_IDS,
} from "@/lib/onboarding-constants";

export type SettingsState = { error: string | null; ok?: boolean };

const ACTIVITY_IDS: Set<string> = new Set(FOTOFFICE_ACTIVITY_TYPES.map((a) => a.id));

export async function updateWorkspaceSettingsAction(
  _prev: SettingsState | undefined,
  formData: FormData,
): Promise<SettingsState> {
  const user = await requireAuth();
  const ensured = await ensureFotofficeWorkspaceForUser({
    userId: user.id,
    email: user.email,
    name: user.name,
  });

  const membership = await prisma.workspaceMembership.findUnique({
    where: {
      userId_workspaceId: { userId: user.id, workspaceId: ensured.workspaceId },
    },
    select: { role: true },
  });
  if (
    !membership ||
    (membership.role !== "WORKSPACE_OWNER" && membership.role !== "WORKSPACE_ADMIN")
  ) {
    return { error: "No tenés permiso para editar este workspace." };
  }

  const commercialName = formData.get("commercialName")?.toString()?.trim() || "";
  const displayName = formData.get("displayName")?.toString()?.trim() || "";
  const contactEmail = formData.get("contactEmail")?.toString()?.trim() || null;
  const phone = formData.get("phone")?.toString()?.trim() || null;
  const city = formData.get("city")?.toString()?.trim() || null;
  const province = formData.get("province")?.toString()?.trim() || null;
  const country = formData.get("country")?.toString()?.trim() || null;
  const website = formData.get("website")?.toString()?.trim() || null;
  const instagram = formData.get("instagram")?.toString()?.trim() || null;
  const activityType = formData.get("activityType")?.toString()?.trim() || "";
  const businessLogoUrl = formData.get("businessLogoUrl")?.toString()?.trim() || null;
  const specialties = formData
    .getAll("specialties")
    .map(String)
    .filter((id) => FOTOFFICE_SPECIALTY_IDS.has(id as never));

  if (!commercialName) return { error: "El nombre comercial es obligatorio." };
  if (!ACTIVITY_IDS.has(activityType)) return { error: "Tipo de actividad inválido." };

  await prisma.fotofficeWorkspaceBranding.update({
    where: { workspaceId: ensured.workspaceId },
    data: {
      commercialName,
      contactEmail,
      phone,
      city,
      province,
      country,
      website,
      instagram,
      activityType,
      specialties,
      logoUrl: businessLogoUrl,
    },
  });
  await prisma.workspace.update({
    where: { id: ensured.workspaceId },
    data: { name: commercialName },
  });
  if (displayName) {
    await prisma.fotofficePhotographerProfile.upsert({
      where: { userId: user.id },
      update: { displayName, phone },
      create: { userId: user.id, displayName, phone },
    });
  }

  revalidatePath("/workspace");
  revalidatePath("/workspace/configuracion");
  return { error: null, ok: true };
}
