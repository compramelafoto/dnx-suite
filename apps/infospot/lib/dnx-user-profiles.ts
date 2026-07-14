/**
 * Perfiles públicos DNX (CUSTOMER / PHOTOGRAPHER / ORGANIZER).
 * No incluye roles editoriales. `User.role` sigue siendo legacy CLF.
 */

import { prisma } from "@repo/db";

export type PublicProfileType = "CUSTOMER" | "PHOTOGRAPHER" | "ORGANIZER";
export type PublicProfileStatus = "ACTIVE" | "PENDING" | "SUSPENDED";
export type PublicProfileSource = "SELF_SELECTED" | "CLF_EXISTING" | "ADMIN_ASSIGNED";

export const PUBLIC_PROFILE_TYPES = [
  "CUSTOMER",
  "PHOTOGRAPHER",
  "ORGANIZER",
] as const satisfies readonly PublicProfileType[];

export function isPublicProfileType(value: string): value is PublicProfileType {
  return (PUBLIC_PROFILE_TYPES as readonly string[]).includes(value);
}

export async function listActivePublicProfiles(userId: number) {
  return prisma.dnxUserProfile.findMany({
    where: { userId, status: "ACTIVE" },
    select: { profileType: true, status: true, source: true },
    orderBy: { profileType: "asc" },
  });
}

export async function hasActivePublicProfile(userId: number): Promise<boolean> {
  const count = await prisma.dnxUserProfile.count({
    where: { userId, status: "ACTIVE" },
  });
  return count > 0;
}

export async function getInfoSpotPreferences(userId: number) {
  return prisma.infoSpotUserPreferences.findUnique({ where: { userId } });
}

export async function isOnboardingComplete(userId: number): Promise<boolean> {
  const prefs = await prisma.infoSpotUserPreferences.findUnique({
    where: { userId },
    select: { onboardingCompletedAt: true },
  });
  return Boolean(prefs?.onboardingCompletedAt);
}

/** Detecta capacidades CLF existentes sin crear usuarios. */
export async function detectClfCapabilities(userId: number): Promise<{
  photographer: boolean;
  organizer: boolean;
  suiteRole: string;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      photographerSalesSettings: { select: { id: true } },
      organizerPublicProfile: { select: { id: true } },
    },
  });
  if (!user) {
    return { photographer: false, organizer: false, suiteRole: "CUSTOMER" };
  }
  const photographer =
    user.role === "PHOTOGRAPHER" ||
    user.role === "LAB_PHOTOGRAPHER" ||
    Boolean(user.photographerSalesSettings);
  const organizer =
    user.role === "ORGANIZER" || Boolean(user.organizerPublicProfile);
  return { photographer, organizer, suiteRole: String(user.role) };
}

/**
 * Upsert de capacidad pública. No toca InfoSpotUserRole.
 * Sync legacy de User.role solo si es promoción segura desde CUSTOMER.
 */
export async function upsertPublicProfile(params: {
  userId: number;
  profileType: PublicProfileType;
  status?: PublicProfileStatus;
  source?: PublicProfileSource;
}): Promise<{
  profileType: PublicProfileType;
  status: PublicProfileStatus;
  source: PublicProfileSource;
}> {
  const clf = await detectClfCapabilities(params.userId);
  let status: PublicProfileStatus = params.status ?? "ACTIVE";
  let source: PublicProfileSource = params.source ?? "SELF_SELECTED";

  if (params.profileType === "PHOTOGRAPHER" && clf.photographer) {
    status = "ACTIVE";
    source = params.source === "ADMIN_ASSIGNED" ? "ADMIN_ASSIGNED" : "CLF_EXISTING";
  } else if (params.profileType === "ORGANIZER" && clf.organizer) {
    status = "ACTIVE";
    source = params.source === "ADMIN_ASSIGNED" ? "ADMIN_ASSIGNED" : "CLF_EXISTING";
  } else if (
    (params.profileType === "PHOTOGRAPHER" || params.profileType === "ORGANIZER") &&
    !params.status
  ) {
    status = "PENDING";
    source = "SELF_SELECTED";
  }

  if (params.profileType === "CUSTOMER") {
    status = "ACTIVE";
    source = params.source ?? "SELF_SELECTED";
  }

  const row = await prisma.dnxUserProfile.upsert({
    where: {
      userId_profileType: {
        userId: params.userId,
        profileType: params.profileType,
      },
    },
    create: {
      userId: params.userId,
      profileType: params.profileType,
      status,
      source,
    },
    update: {
      status,
      source,
    },
    select: { profileType: true, status: true, source: true },
  });

  if (status === "ACTIVE") {
    await maybePromoteLegacySuiteRole(params.userId, params.profileType);
  }

  return row;
}

async function maybePromoteLegacySuiteRole(
  userId: number,
  profileType: PublicProfileType,
): Promise<void> {
  if (profileType === "CUSTOMER") return;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!user || user.role !== "CUSTOMER") return;
  if (profileType === "PHOTOGRAPHER") {
    await prisma.user.update({
      where: { id: userId },
      data: { role: "PHOTOGRAPHER" },
    });
  } else if (profileType === "ORGANIZER") {
    await prisma.user.update({
      where: { id: userId },
      data: { role: "ORGANIZER" },
    });
  }
}

export async function markOnboardingComplete(userId: number): Promise<void> {
  await prisma.infoSpotUserPreferences.upsert({
    where: { userId },
    create: {
      userId,
      onboardingCompletedAt: new Date(),
    },
    update: {
      onboardingCompletedAt: new Date(),
    },
  });
}

export async function saveReaderPreferences(params: {
  userId: number;
  city?: string | null;
  province?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  radiusKm?: number | null;
  interestCategorySlugs?: string[];
  notifyEventsNearby?: boolean;
  notifyCategories?: boolean;
  notifyCalls?: boolean;
  geoConsent?: boolean;
  notificationsConsent?: boolean;
}): Promise<void> {
  const now = new Date();
  await prisma.infoSpotUserPreferences.upsert({
    where: { userId: params.userId },
    create: {
      userId: params.userId,
      city: params.city?.trim() || null,
      province: params.province?.trim() || null,
      latitude: params.latitude ?? null,
      longitude: params.longitude ?? null,
      radiusKm: params.radiusKm ?? null,
      interestCategorySlugs: params.interestCategorySlugs ?? [],
      notifyEventsNearby: params.notifyEventsNearby ?? false,
      notifyCategories: params.notifyCategories ?? false,
      notifyCalls: params.notifyCalls ?? false,
      geoConsentAt: params.geoConsent ? now : null,
      notificationsConsentAt: params.notificationsConsent ? now : null,
    },
    update: {
      city: params.city?.trim() || null,
      province: params.province?.trim() || null,
      latitude: params.latitude ?? null,
      longitude: params.longitude ?? null,
      radiusKm: params.radiusKm ?? null,
      interestCategorySlugs: params.interestCategorySlugs ?? [],
      notifyEventsNearby: params.notifyEventsNearby ?? false,
      notifyCategories: params.notifyCategories ?? false,
      notifyCalls: params.notifyCalls ?? false,
      ...(params.geoConsent ? { geoConsentAt: now } : {}),
      ...(params.notificationsConsent ? { notificationsConsentAt: now } : {}),
    },
  });
}
