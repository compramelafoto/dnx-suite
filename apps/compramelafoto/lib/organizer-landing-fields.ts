import { parseOrganizerLandingModules } from "@/lib/organizer-landing-modules";
import { checkPublicSlugAvailability, normalizePublicSlug } from "@/lib/public-slugs";

const MAX_SHORT = 120;
const MAX_MEDIUM = 500;
const MAX_LONG = 5000;
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

function trimOptional(value: unknown, max: number): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (!t) return null;
  return t.slice(0, max);
}

function trimRequired(value: unknown, label: string, max: number): { ok: true; value: string } | { ok: false; error: string } {
  if (value == null || typeof value !== "string") {
    return { ok: false, error: `${label} es requerido.` };
  }
  const t = value.trim();
  if (!t) return { ok: false, error: `${label} es requerido.` };
  if (t.length > max) return { ok: false, error: `${label} es demasiado largo.` };
  return { ok: true, value: t };
}

function validateHexColor(value: unknown, label: string): { ok: true; value: string | null } | { ok: false; error: string } {
  if (value == null || value === "") return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false, error: `${label} inválido.` };
  const t = value.trim();
  if (!t) return { ok: true, value: null };
  if (!HEX_COLOR.test(t)) {
    return { ok: false, error: `${label} debe ser un color HEX (#RRGGBB).` };
  }
  return { ok: true, value: t };
}

function normalizeWebsite(value: string | null): string | null {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

function normalizeInstagram(value: string | null): string | null {
  if (!value) return null;
  const t = value.trim();
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  const handle = t.replace(/^@/, "").replace(/\s/g, "");
  if (!handle) return null;
  return `https://instagram.com/${handle}`;
}

function normalizeWhatsapp(value: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return digits;
}

function normalizeEmail(value: string | null): string | null {
  if (!value) return null;
  const t = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return null;
  return t;
}

export type OrganizerLandingPatchInput = {
  publicSlug?: string;
  isPublished?: boolean;
  displayName?: string;
  tagline?: string | null;
  description?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  city?: string | null;
  zone?: string | null;
  website?: string | null;
  instagram?: string | null;
  whatsapp?: string | null;
  publicEmail?: string | null;
  modulesJson?: unknown;
  seoTitle?: string | null;
  seoDescription?: string | null;
};

export type OrganizerLandingValidatedPatch = {
  publicSlug: string;
  isPublished: boolean;
  displayName: string;
  tagline: string | null;
  description: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  city: string | null;
  zone: string | null;
  website: string | null;
  instagram: string | null;
  whatsapp: string | null;
  publicEmail: string | null;
  modulesJson: ReturnType<typeof parseOrganizerLandingModules>;
  seoTitle: string | null;
  seoDescription: string | null;
};

export async function validateOrganizerLandingPatch(
  body: unknown,
  options: { excludeUserId: number; excludeProfileId?: number; currentSlug?: string }
): Promise<{ ok: true; data: OrganizerLandingValidatedPatch } | { ok: false; error: string }> {
  if (body == null || typeof body !== "object") {
    return { ok: false, error: "Datos inválidos." };
  }
  const raw = body as Record<string, unknown>;

  const slugRaw = raw.publicSlug ?? options.currentSlug;
  if (slugRaw == null || typeof slugRaw !== "string") {
    return { ok: false, error: "La URL pública (slug) es requerida." };
  }
  const slugCheck = await checkPublicSlugAvailability(slugRaw, {
    excludeUserId: options.excludeUserId,
    excludeProfileId: options.excludeProfileId,
  });
  if (!slugCheck.available) {
    return { ok: false, error: slugCheck.reason };
  }

  const isPublished = raw.isPublished === true;

  const displayNameResult = trimRequired(raw.displayName, "Nombre público", MAX_SHORT);
  if (!displayNameResult.ok && isPublished) {
    return displayNameResult;
  }

  const displayName = displayNameResult.ok
    ? displayNameResult.value
    : trimOptional(raw.displayName, MAX_SHORT) || "Mi organización";

  if (isPublished && displayName.length < 2) {
    return { ok: false, error: "Para publicar necesitás un nombre público." };
  }

  const primary = validateHexColor(raw.primaryColor, "Color principal");
  if (!primary.ok) return primary;
  const secondary = validateHexColor(raw.secondaryColor, "Color secundario");
  if (!secondary.ok) return secondary;

  const websiteRaw = trimOptional(raw.website, MAX_MEDIUM);
  const instagramRaw = trimOptional(raw.instagram, MAX_MEDIUM);
  const whatsappRaw = trimOptional(raw.whatsapp, 40);
  const publicEmailRaw = trimOptional(raw.publicEmail, MAX_SHORT);

  const website = normalizeWebsite(websiteRaw);
  const instagram = normalizeInstagram(instagramRaw);
  const whatsapp = normalizeWhatsapp(whatsappRaw);
  const publicEmail = publicEmailRaw ? normalizeEmail(publicEmailRaw) : null;

  if (publicEmailRaw && !publicEmail) {
    return { ok: false, error: "El email público no es válido." };
  }

  return {
    ok: true,
    data: {
      publicSlug: slugCheck.normalizedSlug,
      isPublished,
      displayName,
      tagline: trimOptional(raw.tagline, MAX_MEDIUM),
      description: trimOptional(raw.description, MAX_LONG),
      primaryColor: primary.value,
      secondaryColor: secondary.value,
      city: trimOptional(raw.city, MAX_SHORT),
      zone: trimOptional(raw.zone, MAX_SHORT),
      website,
      instagram,
      whatsapp,
      publicEmail,
      modulesJson: parseOrganizerLandingModules(raw.modulesJson),
      seoTitle: trimOptional(raw.seoTitle, MAX_SHORT),
      seoDescription: trimOptional(raw.seoDescription, MAX_MEDIUM),
    },
  };
}

export function buildDefaultSlugFromUser(user: { name?: string | null; email: string; id: number }): string {
  const base = user.name?.trim() || user.email.split("@")[0] || `organizador-${user.id}`;
  return normalizePublicSlug(base).slice(0, 40) || `organizador-${user.id}`;
}
