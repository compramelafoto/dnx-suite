import { getR2PublicUrl } from "@/lib/r2-client";
import { sanitizeExternalUrl } from "@/lib/organizer-landing-profile";
import type { OrganizerLandingSponsor } from "@prisma/client";

export type OrganizerSponsorDto = {
  id: number;
  name: string;
  url: string | null;
  sortOrder: number;
  isActive: boolean;
  logoR2Key: string | null;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export function mapOrganizerSponsor(s: OrganizerLandingSponsor): OrganizerSponsorDto {
  const key = s.logoR2Key?.trim();
  return {
    id: s.id,
    name: s.name,
    url: s.url,
    sortOrder: s.sortOrder,
    isActive: s.isActive,
    logoR2Key: s.logoR2Key,
    logoUrl: key ? getR2PublicUrl(key.replace(/^\//, "")) : null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

export function validateSponsorName(value: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (value == null || typeof value !== "string") {
    return { ok: false, error: "El nombre es requerido." };
  }
  const t = value.trim();
  if (t.length < 2) return { ok: false, error: "El nombre debe tener al menos 2 caracteres." };
  if (t.length > 120) return { ok: false, error: "El nombre es demasiado largo." };
  return { ok: true, value: t };
}

export function validateSponsorUrl(value: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (value == null || value === "") return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false, error: "URL inválida." };
  const sanitized = sanitizeExternalUrl(value);
  if (!sanitized) return { ok: false, error: "URL inválida. Usá http o https." };
  return { ok: true, value: sanitized };
}

export function parseSortOrder(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return Math.max(0, Math.floor(n));
  }
  return fallback;
}
