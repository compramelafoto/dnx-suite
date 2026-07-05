import {
  joinTitularName,
  pickContactPhone,
  splitTitularName,
} from "@/lib/photographer/perfil-datos-utils";
import { getCuantoCobroStorage } from "@/lib/cuantocobro/storage/get-cuanto-cobro-storage";

export const CUANTO_COBRO_BUSINESS_PROFILE_KEY = "cuantocobro:business-profile";

export const CC_BUSINESS_PROFILE_UPDATED_EVENT = "cuantocobro:business-profile-updated";

/** Perfil comercial de empresa para presupuestos (localStorage → futuro DB). */
export type CuantoCobroBusinessProfile = {
  tradeName: string;
  photographerFirstName: string;
  photographerLastName: string;
  commercialEmail: string;
  phone: string;
  website: string;
  instagram: string;
  cuit: string;
  taxCondition: string;
  country: string;
  province: string;
  city: string;
  address: string;
  postalCode: string;
  latitude: string;
  longitude: string;
  logoUrl: string;
  updatedAt: string;
  /** Indica si se precargó desde el perfil CLF al primer guardado. */
  seededFromClf?: boolean;
};

export const CC_TAX_CONDITION_OPTIONS = [
  { value: "", label: "Sin especificar" },
  { value: "monotributo", label: "Monotributo" },
  { value: "responsable-inscripto", label: "Responsable inscripto" },
  { value: "exento", label: "Exento" },
  { value: "consumidor-final", label: "Consumidor final" },
] as const;

export const INITIAL_CUANTO_COBRO_BUSINESS_PROFILE: CuantoCobroBusinessProfile = {
  tradeName: "",
  photographerFirstName: "",
  photographerLastName: "",
  commercialEmail: "",
  phone: "",
  website: "",
  instagram: "",
  cuit: "",
  taxCondition: "",
  country: "",
  province: "",
  city: "",
  address: "",
  postalCode: "",
  latitude: "",
  longitude: "",
  logoUrl: "",
  updatedAt: "",
};

type ClfUserBusinessSeed = {
  email?: string;
  name?: string | null;
  companyName?: string | null;
  companyOwner?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  website?: string | null;
  instagram?: string | null;
  cuit?: string | null;
  country?: string | null;
  province?: string | null;
  city?: string | null;
  address?: string | null;
  companyAddress?: string | null;
  postalCode?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  logoUrl?: string | null;
};

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asCoordString(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? String(num) : "";
}

export function normalizeBusinessProfile(
  raw: Partial<CuantoCobroBusinessProfile> | null | undefined,
): CuantoCobroBusinessProfile {
  const base = INITIAL_CUANTO_COBRO_BUSINESS_PROFILE;
  if (!raw) return { ...base };

  return {
    tradeName: asTrimmedString(raw.tradeName),
    photographerFirstName: asTrimmedString(raw.photographerFirstName),
    photographerLastName: asTrimmedString(raw.photographerLastName),
    commercialEmail: asTrimmedString(raw.commercialEmail),
    phone: asTrimmedString(raw.phone),
    website: asTrimmedString(raw.website),
    instagram: asTrimmedString(raw.instagram),
    cuit: asTrimmedString(raw.cuit),
    taxCondition: asTrimmedString(raw.taxCondition),
    country: asTrimmedString(raw.country),
    province: asTrimmedString(raw.province),
    city: asTrimmedString(raw.city),
    address: asTrimmedString(raw.address),
    postalCode: asTrimmedString(raw.postalCode),
    latitude: asCoordString(raw.latitude),
    longitude: asCoordString(raw.longitude),
    logoUrl: asTrimmedString(raw.logoUrl),
    updatedAt: asTrimmedString(raw.updatedAt),
    seededFromClf: raw.seededFromClf === true,
  };
}

export function mapClfUserToBusinessProfileSeed(
  user: ClfUserBusinessSeed,
): Partial<CuantoCobroBusinessProfile> {
  const { firstName, lastName } = splitTitularName(user.name, user.companyOwner);

  return {
    tradeName: asTrimmedString(user.companyName),
    photographerFirstName: firstName,
    photographerLastName: lastName,
    commercialEmail: asTrimmedString(user.email),
    phone: pickContactPhone(user.phone, user.whatsapp),
    website: asTrimmedString(user.website),
    instagram: asTrimmedString(user.instagram),
    cuit: asTrimmedString(user.cuit),
    country: asTrimmedString(user.country),
    province: asTrimmedString(user.province),
    city: asTrimmedString(user.city),
    address: asTrimmedString(user.address) || asTrimmedString(user.companyAddress),
    postalCode: asTrimmedString(user.postalCode),
    latitude: asCoordString(user.latitude),
    longitude: asCoordString(user.longitude),
    logoUrl: asTrimmedString(user.logoUrl),
  };
}

/** Rellena campos vacíos del borrador con datos del perfil CLF (solo lectura). */
export function mergeBusinessProfileDraftWithSeed(
  draft: CuantoCobroBusinessProfile,
  seed: Partial<CuantoCobroBusinessProfile>,
): CuantoCobroBusinessProfile {
  const merged = { ...draft };
  const keys = Object.keys(INITIAL_CUANTO_COBRO_BUSINESS_PROFILE) as Array<
    keyof typeof INITIAL_CUANTO_COBRO_BUSINESS_PROFILE
  >;

  for (const key of keys) {
    if (key === "updatedAt" || key === "seededFromClf") continue;
    const current = merged[key];
    const incoming = seed[key];
    if ((!current || current === "") && incoming) {
      merged[key] = incoming as never;
    }
  }

  return merged;
}

export function loadBusinessProfile(): CuantoCobroBusinessProfile | null {
  return getCuantoCobroStorage().loadBusinessProfile();
}

export function saveBusinessProfile(profile: CuantoCobroBusinessProfile): void {
  getCuantoCobroStorage().saveBusinessProfile(profile);
}

export function hasBusinessProfileContent(profile: CuantoCobroBusinessProfile): boolean {
  const keys = Object.keys(INITIAL_CUANTO_COBRO_BUSINESS_PROFILE) as Array<
    keyof typeof INITIAL_CUANTO_COBRO_BUSINESS_PROFILE
  >;

  return keys.some((key) => {
    if (key === "updatedAt" || key === "seededFromClf") return false;
    return Boolean(profile[key]);
  });
}

export function getBusinessProfileDisplayName(profile: CuantoCobroBusinessProfile): string {
  const trade = profile.tradeName.trim();
  if (trade) return trade;

  const person = joinTitularName(profile.photographerFirstName, profile.photographerLastName);
  return person;
}

export function getBusinessProfileResponsibleName(profile: CuantoCobroBusinessProfile): string {
  return joinTitularName(profile.photographerFirstName, profile.photographerLastName);
}

export function formatBusinessProfileContact(profile: CuantoCobroBusinessProfile): string | null {
  const parts = [profile.commercialEmail.trim(), profile.phone.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function formatBusinessProfileWebSocial(profile: CuantoCobroBusinessProfile): string | null {
  const parts = [profile.website.trim(), profile.instagram.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function formatBusinessProfileAddress(profile: CuantoCobroBusinessProfile): string | null {
  const line = [
    profile.address.trim(),
    profile.city.trim(),
    profile.province.trim(),
    profile.postalCode.trim(),
    profile.country.trim(),
  ].filter(Boolean);

  return line.length > 0 ? line.join(", ") : null;
}

export async function fetchClfBusinessProfileSeed(
  userId: number,
): Promise<Partial<CuantoCobroBusinessProfile>> {
  try {
    const res = await fetch(`/api/fotografo/${userId}`, {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return {};
    const data = (await res.json()) as ClfUserBusinessSeed;
    return mapClfUserToBusinessProfileSeed(data);
  } catch {
    return {};
  }
}

/**
 * Futuro: GET /api/cuantocobro/business-profile
 * Persistencia remota del perfil comercial.
 */
export async function fetchBusinessProfileRemote(): Promise<CuantoCobroBusinessProfile | null> {
  // TODO: conectar con API cuando exista tabla dedicada o mapeo en User.
  return null;
}

/**
 * Futuro: PUT /api/cuantocobro/business-profile
 */
export async function saveBusinessProfileRemote(
  _profile: CuantoCobroBusinessProfile,
): Promise<{ ok: boolean }> {
  // TODO: conectar con API.
  return { ok: false };
}
