import type { DnxPartnerBrandAssetType } from "./assets-types";
import type { PartnerBrandAssetRecord } from "./assets-types";
import type { PartnerContactRecord, PartnerRecord } from "./types";

export type PartnerSponsorReadinessLevel = "ready" | "partial" | "incomplete";

export type PartnerSponsorReadinessMissing =
  | "contact_email"
  | "logo"
  | "logo_approval"
  | "click_destination";

export type PartnerSponsorReadiness = {
  level: PartnerSponsorReadinessLevel;
  /** Campos vitales faltantes o pendientes. */
  missing: PartnerSponsorReadinessMissing[];
  label: string;
  shortLabel: string;
  hasContactEmail: boolean;
  hasLogo: boolean;
  hasApprovedLogo: boolean;
  hasClickDestination: boolean;
};

const LOGO_TYPES = new Set<DnxPartnerBrandAssetType>([
  "LOGO_GENERAL",
  "LOGO_PRIMARY",
]);

function isActiveAsset(asset: Pick<PartnerBrandAssetRecord, "archivedAt" | "status">): boolean {
  if (asset.archivedAt) return false;
  return asset.status !== "ARCHIVED";
}

function hasUsableLogo(
  assets: readonly Pick<
    PartnerBrandAssetRecord,
    "type" | "status" | "archivedAt" | "approvalStatus" | "fileUrl" | "storageKey" | "backgroundType"
  >[],
  partnerLogoUrl?: string | null,
): { hasLogo: boolean; hasApprovedLogo: boolean } {
  const logos = assets.filter(
    (a) =>
      isActiveAsset(a) &&
      LOGO_TYPES.has(a.type) &&
      Boolean(a.fileUrl || a.storageKey),
  );
  if (logos.length === 0 && partnerLogoUrl?.trim()) {
    return { hasLogo: true, hasApprovedLogo: true };
  }
  if (logos.length === 0) return { hasLogo: false, hasApprovedLogo: false };
  const approved = logos.some((a) => a.approvalStatus === "APPROVED");
  return { hasLogo: true, hasApprovedLogo: approved };
}

function hasContactEmail(
  contacts: readonly Pick<PartnerContactRecord, "email" | "archivedAt">[],
  partnerEmail?: string | null,
): boolean {
  if (partnerEmail?.trim()) return true;
  return contacts.some((c) => !c.archivedAt && Boolean(c.email?.trim()));
}

function hasClickDestination(input: {
  websiteUrl?: string | null;
  instagram?: string | null;
  participationDestinationUrls?: readonly (string | null | undefined)[];
}): boolean {
  if (input.websiteUrl?.trim()) return true;
  if (input.instagram?.trim()) return true;
  return (input.participationDestinationUrls ?? []).some((u) => Boolean(u?.trim()));
}

/**
 * Evalúa si un partner tiene la información mínima para operar como sponsor
 * (contacto, logo, destino de click).
 */
export function evaluatePartnerSponsorReadiness(input: {
  partner: Pick<PartnerRecord, "email" | "websiteUrl" | "instagram" | "logoUrl">;
  contacts?: readonly Pick<PartnerContactRecord, "email" | "archivedAt">[];
  assets?: readonly Pick<
    PartnerBrandAssetRecord,
    "type" | "status" | "archivedAt" | "approvalStatus" | "fileUrl" | "storageKey" | "backgroundType"
  >[];
  participationDestinationUrls?: readonly (string | null | undefined)[];
}): PartnerSponsorReadiness {
  const contactOk = hasContactEmail(input.contacts ?? [], input.partner.email);
  const { hasLogo, hasApprovedLogo } = hasUsableLogo(
    input.assets ?? [],
    input.partner.logoUrl,
  );
  const destinationOk = hasClickDestination({
    websiteUrl: input.partner.websiteUrl,
    instagram: input.partner.instagram,
    participationDestinationUrls: input.participationDestinationUrls,
  });

  const missing: PartnerSponsorReadinessMissing[] = [];
  if (!contactOk) missing.push("contact_email");
  if (!hasLogo) missing.push("logo");
  else if (!hasApprovedLogo) missing.push("logo_approval");
  if (!destinationOk) missing.push("click_destination");

  let level: PartnerSponsorReadinessLevel;
  if (missing.length === 0) {
    level = "ready";
  } else if (!hasLogo || !contactOk) {
    level = "incomplete";
  } else {
    // Tiene logo + contacto, pero falta aprobación y/o destino
    level = "partial";
  }

  return {
    level,
    missing,
    label: readinessLabel(level, missing),
    shortLabel:
      level === "ready" ? "Listo" : level === "partial" ? "Parcial" : "Incompleto",
    hasContactEmail: contactOk,
    hasLogo,
    hasApprovedLogo,
    hasClickDestination: destinationOk,
  };
}

export function readinessLabel(
  level: PartnerSponsorReadinessLevel,
  missing: readonly PartnerSponsorReadinessMissing[],
): string {
  if (level === "ready") {
    return "Información mínima completa: contacto, logo aprobado y destino de click.";
  }
  const parts = missing.map((m) => {
    switch (m) {
      case "contact_email":
        return "falta email de contacto";
      case "logo":
        return "falta logo";
      case "logo_approval":
        return "logo pendiente de aprobación";
      case "click_destination":
        return "falta destino de click (Instagram o web)";
      default:
        return m;
    }
  });
  return parts.join(" · ");
}

/** Convierte @handle o URL a perfil Instagram HTTPS. */
export function buildInstagramProfileUrl(instagram: string | null | undefined): string | null {
  const raw = instagram?.trim() ?? "";
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const handle = raw.replace(/^@/, "").replace(/^instagram\.com\//i, "").replace(/\/+$/, "");
  if (!handle) return null;
  return `https://www.instagram.com/${handle}/`;
}
