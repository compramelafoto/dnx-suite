"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";
import {
  isPublicProfileType,
  markOnboardingComplete,
  saveReaderPreferences,
  upsertPublicProfile,
  type PublicProfileType,
} from "@/lib/dnx-user-profiles";

export type OnboardingActionState = {
  ok: boolean;
  message: string;
};

export async function completePublicProfileOnboardingAction(
  _prev: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const user = await requireAuth();

  const selected = formData.getAll("profile").map(String).filter(isPublicProfileType);
  if (selected.length === 0) {
    return {
      ok: false,
      message: "Elegí al menos una forma de usar Info Spot.",
    };
  }

  const unique = Array.from(new Set(selected)) as PublicProfileType[];

  for (const profileType of unique) {
    await upsertPublicProfile({
      userId: user.id,
      profileType,
      source: "SELF_SELECTED",
    });
  }

  const city = formData.get("city")?.toString() ?? "";
  const province = formData.get("province")?.toString() ?? "";
  const radiusRaw = formData.get("radiusKm")?.toString() ?? "";
  const radiusKm = radiusRaw ? Number.parseInt(radiusRaw, 10) : null;
  const interestCategorySlugs = formData
    .getAll("interest")
    .map(String)
    .map((s) => s.trim())
    .filter(Boolean);
  const notifyEventsNearby = formData.get("notifyEventsNearby") === "on";
  const notifyCategories = formData.get("notifyCategories") === "on";
  const notifyCalls = formData.get("notifyCalls") === "on";
  const notificationsConsent = notifyEventsNearby || notifyCategories || notifyCalls;

  if (unique.includes("CUSTOMER")) {
    await saveReaderPreferences({
      userId: user.id,
      city: city || null,
      province: province || null,
      radiusKm: Number.isFinite(radiusKm) ? radiusKm : null,
      interestCategorySlugs,
      notifyEventsNearby,
      notifyCategories,
      notifyCalls,
      notificationsConsent,
    });
  }

  await markOnboardingComplete(user.id);

  revalidatePath("/");
  revalidatePath("/completar-perfil");
  redirect("/");
}

export async function skipReaderPreferencesAction(): Promise<void> {
  const user = await requireAuth();
  // Si ya eligió perfiles en el mismo form, no aplica; este path es “omitir y continuar” solo prefs.
  const hasProfile = await prisma.dnxUserProfile.count({ where: { userId: user.id } });
  if (hasProfile === 0) {
    await upsertPublicProfile({
      userId: user.id,
      profileType: "CUSTOMER",
      source: "SELF_SELECTED",
    });
  }
  await markOnboardingComplete(user.id);
  redirect("/");
}
