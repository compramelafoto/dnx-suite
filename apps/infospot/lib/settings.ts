import { cache } from "react";
import { prisma } from "@repo/db";

export type InfoSpotPublicSettings = {
  id: string;
  siteName: string;
  slogan: string;
  logoUrl: string | null;
  contactEmail: string | null;
  pressEmail: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  xUrl: string | null;
  whatsappUrl: string | null;
  publicUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  defaultShareImageUrl: string | null;
  baseCity: string | null;
  country: string | null;
  institutionalText: string | null;
  footerText: string | null;
};

const DEFAULT_INSTITUTIONAL = `Info Spot es un medio digital argentino dedicado a la difusión y cobertura de eventos deportivos, culturales y sociales.

Trabajamos junto a una red de fotógrafos, redactores y colaboradores de distintas localidades del país, generando contenido periodístico y visual para acercar cada evento a su comunidad.

Info Spot conecta organizadores, participantes, fotógrafos y medios en un único espacio, ayudando a que cada acontecimiento alcance mayor visibilidad y construya una historia permanente.`;

const DEFAULTS: Omit<InfoSpotPublicSettings, "id"> = {
  siteName: "Info Spot",
  slogan: "Descubrí lo que está pasando cerca tuyo.",
  logoUrl: null,
  contactEmail: null,
  pressEmail: null,
  instagramUrl: null,
  facebookUrl: null,
  xUrl: null,
  whatsappUrl: null,
  publicUrl: process.env.NEXT_PUBLIC_INFOSPOT_URL ?? null,
  seoTitle: "Info Spot",
  seoDescription:
    "Medio digital argentino dedicado a la cobertura, difusión y comunicación de eventos deportivos, culturales y sociales.",
  defaultShareImageUrl: "/brand/og-default.png",
  baseCity: null,
  country: "Argentina",
  institutionalText: DEFAULT_INSTITUTIONAL,
  footerText:
    "Medio digital argentino. Cobertura deportiva, cultural y social con mirada fotográfica.",
};

/** Campos institucionales que bloquean go-live si faltan. */
export type LaunchBlocker = {
  id: string;
  label: string;
  severity: "block" | "warn";
};

export function getLaunchInstitutionalBlockers(
  settings: InfoSpotPublicSettings,
  raw?: {
    contactEmail: string | null;
    pressEmail: string | null;
    publicUrl: string | null;
    baseCity: string | null;
    country: string | null;
    institutionalText: string | null;
    seoDescription: string | null;
    defaultShareImageUrl: string | null;
    instagramUrl: string | null;
    facebookUrl: string | null;
    xUrl: string | null;
    whatsappUrl: string | null;
  } | null,
): LaunchBlocker[] {
  const blockers: LaunchBlocker[] = [];
  const missing = (id: string, label: string, severity: "block" | "warn" = "block") => {
    blockers.push({ id, label, severity });
  };

  const src = raw ?? {
    contactEmail: settings.contactEmail,
    pressEmail: settings.pressEmail,
    publicUrl: settings.publicUrl,
    baseCity: settings.baseCity,
    country: settings.country,
    institutionalText: settings.institutionalText,
    seoDescription: settings.seoDescription,
    defaultShareImageUrl: settings.defaultShareImageUrl,
    instagramUrl: settings.instagramUrl,
    facebookUrl: settings.facebookUrl,
    xUrl: settings.xUrl,
    whatsappUrl: settings.whatsappUrl,
  };

  if (!src.contactEmail?.trim()) missing("contactEmail", "Email editorial");
  if (!src.pressEmail?.trim()) missing("pressEmail", "Email de prensa");
  if (!src.publicUrl?.trim() && !process.env.NEXT_PUBLIC_INFOSPOT_URL?.trim()) {
    missing("publicUrl", "URL pública canónica");
  }
  if (!src.baseCity?.trim()) missing("baseCity", "Ciudad base");
  if (!src.country?.trim()) missing("country", "País");
  if (!src.institutionalText?.trim()) {
    missing("institutionalText", "Texto institucional");
  }
  if (!src.seoDescription?.trim()) missing("seoDescription", "Descripción SEO");
  if (!src.defaultShareImageUrl?.trim()) {
    missing("defaultShareImageUrl", "Imagen Open Graph");
  }

  const hasAnySocial =
    Boolean(src.instagramUrl?.trim()) ||
    Boolean(src.facebookUrl?.trim()) ||
    Boolean(src.xUrl?.trim()) ||
    Boolean(src.whatsappUrl?.trim());
  if (!hasAnySocial) {
    missing(
      "socials",
      "Redes sociales: cargar URLs reales o confirmar ausencia explícita en admin",
      "warn",
    );
  }

  return blockers;
}

/** Settings del medio (singleton). Cache por request. */
export const getInfoSpotSettings = cache(async (): Promise<InfoSpotPublicSettings> => {
  const row = await prisma.infoSpotSettings.findFirst({
    orderBy: { createdAt: "asc" },
  });
  if (!row) {
    return { id: "defaults", ...DEFAULTS };
  }
  return {
    id: row.id,
    siteName: row.siteName || DEFAULTS.siteName,
    slogan: row.slogan || DEFAULTS.slogan,
    logoUrl: row.logoUrl,
    contactEmail: row.contactEmail,
    pressEmail: row.pressEmail,
    instagramUrl: row.instagramUrl,
    facebookUrl: row.facebookUrl,
    xUrl: row.xUrl,
    whatsappUrl: row.whatsappUrl,
    publicUrl: row.publicUrl || DEFAULTS.publicUrl,
    seoTitle: row.seoTitle || DEFAULTS.seoTitle,
    seoDescription: row.seoDescription || DEFAULTS.seoDescription,
    defaultShareImageUrl: row.defaultShareImageUrl || DEFAULTS.defaultShareImageUrl,
    baseCity: row.baseCity,
    country: row.country || DEFAULTS.country,
    institutionalText: row.institutionalText || DEFAULTS.institutionalText,
    footerText: row.footerText || DEFAULTS.footerText,
  };
});

export function getSiteUrl(settings?: Pick<InfoSpotPublicSettings, "publicUrl">): string {
  return (
    settings?.publicUrl?.trim() ||
    process.env.NEXT_PUBLIC_INFOSPOT_URL?.trim() ||
    "http://localhost:3004"
  );
}

export function mailtoEditorial(settings: InfoSpotPublicSettings, subject?: string): string | null {
  const email = settings.contactEmail?.trim();
  if (!email) return null;
  const q = subject ? `?subject=${encodeURIComponent(subject)}` : "";
  return `mailto:${email}${q}`;
}

export function mailtoPress(settings: InfoSpotPublicSettings, subject?: string): string | null {
  const email = (settings.pressEmail || settings.contactEmail)?.trim();
  if (!email) return null;
  const q = subject ? `?subject=${encodeURIComponent(subject)}` : "";
  return `mailto:${email}${q}`;
}

export { DEFAULT_INSTITUTIONAL, DEFAULTS as SETTINGS_DEFAULTS };
