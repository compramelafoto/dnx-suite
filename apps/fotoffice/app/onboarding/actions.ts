"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";
import { ensureFotofficeWorkspaceForUser } from "@/lib/ensure-workspace";
import {
  FOTOFFICE_ACTIVITY_TYPES,
  FOTOFFICE_SPECIALTY_IDS,
} from "@/lib/onboarding-constants";
import { cookies } from "next/headers";
import { FOTOFFICE_WORKSPACE_COOKIE } from "@/lib/courses-sales/constants";

export type OnboardingState = { error: string | null; ok?: boolean };

const ACTIVITY_IDS: Set<string> = new Set(FOTOFFICE_ACTIVITY_TYPES.map((a) => a.id));

async function requireOwnedWorkspace(userId: number, email: string, name: string | null) {
  const ensured = await ensureFotofficeWorkspaceForUser({ userId, email, name });
  const membership = await prisma.workspaceMembership.findUnique({
    where: {
      userId_workspaceId: { userId, workspaceId: ensured.workspaceId },
    },
    select: { role: true },
  });
  if (!membership) {
    throw new Error("Sin membresía en el workspace.");
  }
  return ensured.workspaceId;
}

export async function saveOnboardingPersonalAction(
  _prev: OnboardingState | undefined,
  formData: FormData,
): Promise<OnboardingState> {
  const user = await requireAuth();
  const firstName = formData.get("firstName")?.toString()?.trim() || "";
  const lastName = formData.get("lastName")?.toString()?.trim() || "";
  const displayName =
    formData.get("displayName")?.toString()?.trim() ||
    [firstName, lastName].filter(Boolean).join(" ") ||
    user.name ||
    "";
  const phone = formData.get("phone")?.toString()?.trim() || null;

  if (!displayName) {
    return { error: "Indicá un nombre visible." };
  }

  await prisma.fotofficePhotographerProfile.upsert({
    where: { userId: user.id },
    update: { firstName: firstName || null, lastName: lastName || null, displayName, phone },
    create: {
      userId: user.id,
      firstName: firstName || null,
      lastName: lastName || null,
      displayName,
      phone,
      avatarUrl: null,
    },
  });

  if (displayName && (!user.name || !user.name.trim())) {
    await prisma.user.update({
      where: { id: user.id },
      data: { name: displayName, ...(phone ? { phone } : {}) },
    });
  } else if (phone) {
    await prisma.user.update({
      where: { id: user.id },
      data: { phone },
    });
  }

  revalidatePath("/onboarding");
  return { error: null, ok: true };
}

export async function saveOnboardingBusinessAction(
  _prev: OnboardingState | undefined,
  formData: FormData,
): Promise<OnboardingState> {
  const user = await requireAuth();
  const workspaceId = await requireOwnedWorkspace(user.id, user.email, user.name);

  const commercialName = formData.get("commercialName")?.toString()?.trim() || "";
  const activityType = formData.get("activityType")?.toString()?.trim() || "";
  const city = formData.get("city")?.toString()?.trim() || null;
  const province = formData.get("province")?.toString()?.trim() || null;
  const country = formData.get("country")?.toString()?.trim() || null;
  const website = formData.get("website")?.toString()?.trim() || null;
  const instagram = formData.get("instagram")?.toString()?.trim() || null;

  if (!commercialName) return { error: "El nombre comercial es obligatorio." };
  if (!ACTIVITY_IDS.has(activityType)) {
    return { error: "Elegí un tipo de actividad válido." };
  }

  await prisma.fotofficeWorkspaceBranding.update({
    where: { workspaceId },
    data: {
      commercialName,
      activityType,
      city,
      province,
      country,
      website,
      instagram,
    },
  });
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { name: commercialName },
  });

  revalidatePath("/onboarding");
  return { error: null, ok: true };
}

export async function saveOnboardingSpecialtiesAction(
  _prev: OnboardingState | undefined,
  formData: FormData,
): Promise<OnboardingState> {
  const user = await requireAuth();
  const workspaceId = await requireOwnedWorkspace(user.id, user.email, user.name);

  const raw = formData.getAll("specialties").map((v) => String(v));
  const specialties = raw.filter((id) => FOTOFFICE_SPECIALTY_IDS.has(id as never));

  await prisma.fotofficeWorkspaceBranding.update({
    where: { workspaceId },
    data: {
      specialties,
      onboardingCompletedAt: new Date(),
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(FOTOFFICE_WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/workspace");
  redirect("/workspace");
}

export async function skipOnboardingAction(): Promise<void> {
  const user = await requireAuth();
  const workspaceId = await requireOwnedWorkspace(user.id, user.email, user.name);
  await prisma.fotofficeWorkspaceBranding.update({
    where: { workspaceId },
    data: { onboardingCompletedAt: new Date() },
  });
  const cookieStore = await cookies();
  cookieStore.set(FOTOFFICE_WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/workspace");
}
