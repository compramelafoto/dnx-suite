import {
  normalizeBusinessProfile,
  type CuantoCobroBusinessProfile,
} from "../business-profile";
import {
  PHOTOGRAPHER_VISUAL_IDENTITY_DEFAULTS,
  mapUserToPhotographerVisualIdentity,
  type PhotographerVisualIdentity,
  type PhotographerVisualIdentityUserRow,
} from "../../photographer/visual-identity";
import { pickContactPhone, splitTitularName } from "@/lib/photographer/perfil-datos-utils";

/** Fallback institucional CLF — mismo que `PhotographerPublicPage`. */
export const CC_QUOTE_BRANDING_ACCENT_FALLBACK = PHOTOGRAPHER_VISUAL_IDENTITY_DEFAULTS.primaryColor;

/** Datos comerciales + identidad visual congelada para presupuestos. */
export type PhotographerBrandingSource = PhotographerVisualIdentity & {
  photographerFirstName: string | null;
  photographerLastName: string | null;
  businessName: string | null;
};

export type QuoteBrandingSnapshot = CuantoCobroBusinessProfile & {
  primaryColor?: string;
  secondaryColor?: string;
  tertiaryColor?: string;
  fontColor?: string;
  /** Logo del User CLF congelado al armar la versión. */
  photographerLogoUrl?: string;
};

type PhotographerBrandingUserRow = PhotographerVisualIdentityUserRow;

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function pickNonEmpty(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const trimmed = readString(value);
    if (trimmed) return trimmed;
  }
  return "";
}

export function mapUserRowToPhotographerBrandingSource(
  user: PhotographerBrandingUserRow,
): PhotographerBrandingSource {
  const visual = mapUserToPhotographerVisualIdentity(user);
  const { firstName, lastName } = splitTitularName(user.name, user.companyOwner);

  return {
    ...visual,
    businessName: visual.companyName || visual.displayName,
    photographerFirstName: firstName || null,
    photographerLastName: lastName || null,
  };
}

/**
 * Completa datos comerciales del snapshot y congela identidad visual desde User CLF.
 * La identidad visual NO se toma del perfil comercial local de ¿Cuánto Cobro?.
 */
export function mergeQuoteBrandingSnapshot(
  stored: unknown,
  photographer: PhotographerBrandingSource | null,
): Record<string, unknown> {
  const storedRecord =
    stored && typeof stored === "object" && !Array.isArray(stored)
      ? (stored as Record<string, unknown>)
      : {};

  const base = normalizeBusinessProfile(stored as Partial<CuantoCobroBusinessProfile>);
  const photographerLogo = photographer?.logoUrl?.trim() || "";
  const frozenLogo = pickNonEmpty(
    readString(storedRecord.photographerLogoUrl),
    readString(storedRecord.logoUrl),
  );

  const merged: QuoteBrandingSnapshot = {
    ...base,
    tradeName: pickNonEmpty(base.tradeName, photographer?.businessName, photographer?.displayName),
    photographerFirstName: pickNonEmpty(
      base.photographerFirstName,
      photographer?.photographerFirstName,
    ),
    photographerLastName: pickNonEmpty(base.photographerLastName, photographer?.photographerLastName),
    commercialEmail: pickNonEmpty(base.commercialEmail, photographer?.email),
    phone: pickNonEmpty(base.phone, pickContactPhone(photographer?.phone, photographer?.whatsapp)),
    website: pickNonEmpty(base.website, photographer?.website),
    instagram: pickNonEmpty(base.instagram, photographer?.instagram),
    logoUrl: photographer
      ? pickNonEmpty(photographerLogo, frozenLogo)
      : pickNonEmpty(frozenLogo, ""),
    photographerLogoUrl: photographer
      ? pickNonEmpty(photographerLogo, frozenLogo)
      : pickNonEmpty(frozenLogo, ""),
    primaryColor: photographer
      ? photographer.primaryColor
      : pickNonEmpty(
          readString(storedRecord.primaryColor),
          PHOTOGRAPHER_VISUAL_IDENTITY_DEFAULTS.primaryColor,
        ),
    secondaryColor: photographer
      ? photographer.secondaryColor
      : pickNonEmpty(
          readString(storedRecord.secondaryColor),
          PHOTOGRAPHER_VISUAL_IDENTITY_DEFAULTS.secondaryColor,
        ),
    tertiaryColor: photographer
      ? photographer.tertiaryColor
      : pickNonEmpty(
          readString(storedRecord.tertiaryColor),
          PHOTOGRAPHER_VISUAL_IDENTITY_DEFAULTS.tertiaryColor,
        ),
    fontColor: photographer
      ? photographer.fontColor
      : pickNonEmpty(
          readString(storedRecord.fontColor),
          PHOTOGRAPHER_VISUAL_IDENTITY_DEFAULTS.fontColor,
        ),
  };

  return merged;
}

export function enrichBusinessProfileSnapshotForStorage(
  stored: unknown,
  photographer: PhotographerBrandingSource | null,
): Record<string, unknown> {
  return mergeQuoteBrandingSnapshot(stored, photographer);
}

export function parseQuoteBrandingSnapshot(value: unknown): QuoteBrandingSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const merged = mergeQuoteBrandingSnapshot(value, null) as QuoteBrandingSnapshot;
  const hasIdentity =
    Boolean(merged.tradeName.trim()) ||
    Boolean(merged.commercialEmail.trim()) ||
    Boolean(merged.logoUrl.trim()) ||
    Boolean(merged.photographerLogoUrl?.trim()) ||
    Boolean(readString(merged.primaryColor));

  if (!hasIdentity) return null;
  return merged;
}

export function resolveQuoteAccentHex(snapshot: unknown): string {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return CC_QUOTE_BRANDING_ACCENT_FALLBACK;
  }

  const record = snapshot as Record<string, unknown>;
  const candidate = readString(record.primaryColor);
  return candidate || CC_QUOTE_BRANDING_ACCENT_FALLBACK;
}

export function resolveBrandingLogoUrl(snapshot: unknown): string | null {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;

  const record = snapshot as Record<string, unknown>;
  const candidate = pickNonEmpty(
    readString(record.photographerLogoUrl),
    readString(record.logoUrl),
  );

  return candidate || null;
}

export function normalizeQuoteLogoCandidateUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("data:") || /^https?:\/\//i.test(trimmed)) return trimmed;

  if (trimmed.startsWith("/")) {
    const base =
      readString(process.env.NEXT_PUBLIC_APP_URL) ||
      (readString(process.env.VERCEL_URL)
        ? `https://${readString(process.env.VERCEL_URL).replace(/^https?:\/\//, "")}`
        : "");
    if (!base) return null;
    return `${base.replace(/\/$/, "")}${trimmed}`;
  }

  return null;
}

export function collectQuoteLogoCandidatesFromSnapshot(snapshot: unknown): string[] {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return [];

  const record = snapshot as Record<string, unknown>;
  const rawCandidates = [
    readString(record.photographerLogoUrl),
    readString(record.logoUrl),
  ];

  const seen = new Set<string>();
  const resolved: string[] = [];

  for (const item of rawCandidates) {
    const normalized = normalizeQuoteLogoCandidateUrl(item);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    resolved.push(normalized);
  }

  return resolved;
}

export function businessProfileForCommercialProposal(
  snapshot: unknown,
): CuantoCobroBusinessProfile | null {
  const branding = parseQuoteBrandingSnapshot(snapshot);
  if (!branding) return null;

  const logoUrl = resolveBrandingLogoUrl(branding) ?? "";
  return {
    ...branding,
    logoUrl,
  };
}
