"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { prisma, Role } from "@/lib/prisma";

export type PrefsActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export async function saveNotificationPreferencesAction(
  formData: FormData,
): Promise<PrefsActionResult> {
  const { error, user } = await requireAuth([
    Role.PHOTOGRAPHER,
    Role.LAB_PHOTOGRAPHER,
  ]);
  if (error || !user) return { ok: false, error: "Debés iniciar sesión como fotógrafo." };

  const nearby = formData.get("nearbyPhotographerCalls") === "on";
  const channelInApp = formData.get("channelInApp") === "on";
  const channelEmail = formData.get("channelEmail") === "on";
  const scopeModeRaw = String(formData.get("preferredScopeMode") || "RADIUS_KM");
  const preferredScopeMode =
    scopeModeRaw === "CITY" || scopeModeRaw === "PROVINCE" || scopeModeRaw === "RADIUS_KM"
      ? scopeModeRaw
      : "RADIUS_KM";
  const radiusKm = Number(formData.get("preferredRadiusKm") || 50);
  if (
    preferredScopeMode === "RADIUS_KM" &&
    (!Number.isFinite(radiusKm) || radiusKm < 1 || radiusKm > 250)
  ) {
    return { ok: false, error: "Radio inválido (1–250 km)." };
  }
  const useProfileLocation = formData.get("useProfileLocation") !== "off";
  const manualCity = String(formData.get("manualCity") || "").trim() || null;

  if (channelEmail && !nearby) {
    return {
      ok: false,
      error: "Para recibir email de convocatorias, activá «Convocatorias cercanas».",
    };
  }

  await prisma.dnxNotificationPreference.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      nearbyPhotographerCalls: nearby,
      channelInApp: channelInApp || true,
      channelEmail,
      preferredScopeMode,
      preferredRadiusKm: preferredScopeMode === "RADIUS_KM" ? Math.round(radiusKm) : null,
      useProfileLocation,
      manualCity: useProfileLocation ? null : manualCity,
      externalMarketingConsentAt: channelEmail ? new Date() : null,
    },
    update: {
      nearbyPhotographerCalls: nearby,
      channelInApp: channelInApp || nearby,
      channelEmail,
      preferredScopeMode,
      preferredRadiusKm: preferredScopeMode === "RADIUS_KM" ? Math.round(radiusKm) : null,
      useProfileLocation,
      manualCity: useProfileLocation ? null : manualCity,
      externalMarketingConsentAt: channelEmail ? new Date() : null,
    },
  });

  revalidatePath("/fotografo/configuracion/notificaciones");
  revalidatePath("/fotografo/notificaciones");
  return { ok: true, message: "Preferencias guardadas." };
}
