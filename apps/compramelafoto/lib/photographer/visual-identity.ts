import { pickContactPhone, splitTitularName } from "@/lib/photographer/perfil-datos-utils";

/**
 * Identidad visual del fotógrafo en ComprameLaFoto / FotoOffice.
 * Fuente de verdad: modelo `User` (configuración → Preferencias de marca / Identidad visual).
 * Mismos defaults que `PhotographerPublicPage` y `PreferenciasMarcaSection`.
 */
export const PHOTOGRAPHER_VISUAL_IDENTITY_DEFAULTS = {
  primaryColor: "#c27b3d",
  secondaryColor: "#2d2d2d",
  tertiaryColor: "#c27b3d",
  fontColor: "#1a1a1a",
  pageBackgroundColor: "#ffffff",
} as const;

export type PhotographerVisualIdentity = {
  logoUrl: string | null;
  displayName: string | null;
  companyName: string | null;
  /** Color principal — botones, acentos, links destacados (User.primaryColor). */
  primaryColor: string;
  secondaryColor: string;
  tertiaryColor: string;
  fontColor: string;
  headerBackgroundColor: string;
  footerBackgroundColor: string | null;
  heroBackgroundColor: string;
  pageBackgroundColor: string;
  /** Alias de primaryColor — misma semántica que la landing pública. */
  accentColor: string;
  buttonColor: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  instagram: string | null;
};

export type PhotographerVisualIdentityUserRow = {
  email: string;
  name: string | null;
  companyName: string | null;
  companyOwner: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  tertiaryColor: string | null;
  fontColor: string | null;
  headerBackgroundColor: string | null;
  footerBackgroundColor: string | null;
  heroBackgroundColor: string | null;
  pageBackgroundColor: string | null;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  instagram: string | null;
};

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readHexColor(value: string | null | undefined, fallback: string): string {
  const trimmed = readString(value);
  if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) return trimmed;
  return fallback;
}

export function mapUserToPhotographerVisualIdentity(
  user: PhotographerVisualIdentityUserRow,
): PhotographerVisualIdentity {
  const { firstName, lastName } = splitTitularName(user.name, user.companyOwner);
  const personName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const companyName = readString(user.companyName) || null;
  const displayName = companyName || personName || readString(user.email) || null;

  const primaryColor = readHexColor(
    user.primaryColor,
    PHOTOGRAPHER_VISUAL_IDENTITY_DEFAULTS.primaryColor,
  );
  const secondaryColor = readHexColor(
    user.secondaryColor,
    PHOTOGRAPHER_VISUAL_IDENTITY_DEFAULTS.secondaryColor,
  );
  const tertiaryColor = readHexColor(
    user.tertiaryColor,
    primaryColor,
  );
  const fontColor = readHexColor(user.fontColor, PHOTOGRAPHER_VISUAL_IDENTITY_DEFAULTS.fontColor);
  const pageBackgroundColor = readHexColor(
    user.pageBackgroundColor,
    PHOTOGRAPHER_VISUAL_IDENTITY_DEFAULTS.pageBackgroundColor,
  );
  const heroBackgroundColor = readHexColor(user.heroBackgroundColor, secondaryColor);
  const headerBackgroundColor = readHexColor(user.headerBackgroundColor, secondaryColor);
  const footerBackgroundColor = user.footerBackgroundColor
    ? readHexColor(user.footerBackgroundColor, secondaryColor)
    : null;

  return {
    logoUrl: readString(user.logoUrl) || null,
    displayName,
    companyName,
    primaryColor,
    secondaryColor,
    tertiaryColor,
    fontColor,
    headerBackgroundColor,
    footerBackgroundColor,
    heroBackgroundColor,
    pageBackgroundColor,
    accentColor: primaryColor,
    buttonColor: primaryColor,
    email: readString(user.email) || null,
    phone: readString(user.phone) || null,
    whatsapp: readString(user.whatsapp) || null,
    website: readString(user.website) || null,
    instagram: readString(user.instagram) || null,
  };
}

/** Variables CSS para aplicar la identidad del fotógrafo en ¿Cuánto Cobro? y otros módulos. */
export function buildPhotographerVisualIdentityCssVars(
  identity: PhotographerVisualIdentity,
): Record<string, string> {
  return {
    "--photographer-primary": identity.primaryColor,
    "--photographer-secondary": identity.secondaryColor,
    "--photographer-tertiary": identity.tertiaryColor,
    "--photographer-font": identity.fontColor,
    "--photographer-accent": identity.accentColor,
    "--cc-color-primary": identity.primaryColor,
    "--cc-color-primary-hover": identity.primaryColor,
    "--cc-color-accent": identity.accentColor,
    "--cc-accent": identity.accentColor,
  };
}

export function resolvePhotographerAccentHex(identity: PhotographerVisualIdentity | null): string {
  return identity?.accentColor ?? PHOTOGRAPHER_VISUAL_IDENTITY_DEFAULTS.primaryColor;
}

export function resolvePhotographerLogoUrl(identity: PhotographerVisualIdentity | null): string | null {
  return identity?.logoUrl ?? null;
}

export function resolvePhotographerCommercialPhone(identity: PhotographerVisualIdentity | null): string {
  return pickContactPhone(identity?.phone, identity?.whatsapp);
}
