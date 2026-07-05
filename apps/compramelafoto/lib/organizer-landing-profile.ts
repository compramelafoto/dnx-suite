import { Role } from "@prisma/client";
import { buildDefaultSlugFromUser } from "@/lib/organizer-landing-fields";
import { defaultOrganizerLandingModules } from "@/lib/organizer-landing-modules";
import { checkPublicSlugAvailability } from "@/lib/public-slugs";
import { prisma } from "@/lib/prisma";

export const ORGANIZER_LANDING_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export const ORGANIZER_LANDING_LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const ORGANIZER_LANDING_BANNER_MAX_BYTES = 5 * 1024 * 1024;
export const ORGANIZER_LANDING_SPONSOR_LOGO_MAX_BYTES = 2 * 1024 * 1024;

export function extensionForImageMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m === "image/png") return "png";
  if (m === "image/webp") return "webp";
  return "jpg";
}

export async function resolveAvailableSlug(base: string, userId: number): Promise<string> {
  let candidate = base;
  for (let i = 0; i < 8; i++) {
    const check = await checkPublicSlugAvailability(candidate, { excludeUserId: userId });
    if (check.available) return check.normalizedSlug;
    candidate = `${base}-${userId}${i > 0 ? `-${i}` : ""}`.slice(0, 55);
  }
  const fallback = `organizador-${userId}`;
  const finalCheck = await checkPublicSlugAvailability(fallback, { excludeUserId: userId });
  return finalCheck.available ? finalCheck.normalizedSlug : `${fallback}-${Date.now()}`.slice(0, 60);
}

/**
 * Obtiene o crea un perfil mínimo para permitir uploads antes de guardar el formulario completo.
 */
export async function ensureOrganizerPublicProfile(userId: number) {
  const existing = await prisma.organizerPublicProfile.findUnique({
    where: { userId },
  });
  if (existing) return existing;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, companyName: true, city: true, province: true, role: true },
  });

  if (!user || (user.role !== Role.ORGANIZER && user.role !== Role.SCHOOL_ORGANIZER)) {
    throw new Error("Usuario no autorizado como organizador");
  }

  const baseSlug = buildDefaultSlugFromUser(user);
  const publicSlug = await resolveAvailableSlug(baseSlug, userId);

  return prisma.organizerPublicProfile.create({
    data: {
      userId,
      publicSlug,
      displayName: (user.companyName || user.name || "Mi organización").trim().slice(0, 120),
      city: user.city,
      zone: user.province,
      modulesJson: defaultOrganizerLandingModules(),
      isPublished: false,
    },
  });
}

export async function getOrganizerProfileForUser(userId: number) {
  const profile = await prisma.organizerPublicProfile.findUnique({ where: { userId } });
  if (!profile) return null;
  return profile;
}

export async function requireOrganizerOwnedProfile(userId: number) {
  const profile = await ensureOrganizerPublicProfile(userId);
  return profile;
}

export async function requireOrganizerOwnedSponsor(userId: number, sponsorId: number) {
  const profile = await requireOrganizerOwnedProfile(userId);
  const sponsor = await prisma.organizerLandingSponsor.findFirst({
    where: { id: sponsorId, profileId: profile.id },
  });
  if (!sponsor) {
    throw new Error("SPONSOR_NOT_FOUND");
  }
  return { profile, sponsor };
}

export async function requireOrganizerOwnedOfficialPhotographer(
  userId: number,
  officialPhotographerId: number
) {
  const profile = await requireOrganizerOwnedProfile(userId);
  const row = await prisma.organizerOfficialPhotographer.findFirst({
    where: { id: officialPhotographerId, profileId: profile.id },
  });
  if (!row) {
    throw new Error("OFFICIAL_PHOTOGRAPHER_NOT_FOUND");
  }
  return { profile, row };
}

export function validateLandingImageFile(
  file: File,
  maxBytes: number
): { ok: true; contentType: string } | { ok: false; error: string } {
  if (!file || file.size <= 0) {
    return { ok: false, error: "No se envió ningún archivo." };
  }
  const contentType = (file.type || "").toLowerCase().split(";")[0].trim();
  if (!ORGANIZER_LANDING_IMAGE_MIME.has(contentType)) {
    return { ok: false, error: "Formato no permitido. Usá JPG, PNG o WebP." };
  }
  if (file.size > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024));
    return { ok: false, error: `El archivo no puede superar ${mb} MB.` };
  }
  return { ok: true, contentType };
}

export function sanitizeExternalUrl(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\s*javascript:/i.test(trimmed)) return null;
  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const u = new URL(withProto);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}
