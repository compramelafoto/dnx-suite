/**
 * Datos del fotógrafo que entra a Cam Of Duty (sin base ni sesión, para poder probarlo).
 *
 * Cam Of Duty es de uso libre pero con cuenta de fotógrafo de CompraMeLaFoto:
 * nombre y apellido, WhatsApp, Instagram, empresa o estudio y ciudad ubicada en
 * el mapa, más si quiere enterarse de trabajos cerca. Así queda una base de
 * fotógrafos georreferenciada.
 */

import { createHash, randomInt } from "crypto";

export interface ProfileInput {
  firstName?: unknown;
  lastName?: unknown;
  whatsapp?: unknown;
  instagram?: unknown;
  company?: unknown;
  city?: unknown;
  province?: unknown;
  country?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  jobAlerts?: unknown;
}

export interface CleanProfile {
  firstName: string;
  lastName: string;
  whatsapp: string;
  instagram: string | null;
  company: string;
  city: string;
  province: string | null;
  country: string | null;
  latitude: number;
  longitude: number;
  jobAlerts: boolean;
}

export type ProfileErrors = Partial<Record<keyof CleanProfile, string>>;

const text = (v: unknown, max = 120) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");

/**
 * WhatsApp argentino en formato internacional (+549 + 10 dígitos). Acepta como
 * lo escribe la gente: "341 155 123456", "0341-15-5123456", "+54 9 341 5123456".
 * Devuelve null si no es un celular válido. Otros países: con + y 8 a 15 dígitos.
 */
export function normalizeWhatsapp(raw: unknown): string | null {
  const s = text(raw, 40);
  if (!s) return null;
  if (s.startsWith("+") && !s.startsWith("+54")) {
    const digits = s.replace(/\D/g, "");
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }
  let d = s.replace(/\D/g, "");
  if (d.startsWith("54")) d = d.slice(2);
  if (d.startsWith("9")) d = d.slice(1);
  if (d.startsWith("0")) d = d.slice(1);
  // El "15" de los celulares va después del código de área (2 a 4 dígitos): se quita.
  for (const area of [2, 3, 4]) {
    if (d.length === 12 && d.slice(area, area + 2) === "15") {
      d = d.slice(0, area) + d.slice(area + 2);
      break;
    }
  }
  return d.length === 10 ? `+549${d}` : null;
}

/** Usuario de Instagram sin @ ni enlace (letras, números, punto y guion bajo; hasta 30). */
export function normalizeInstagram(raw: unknown): string | null {
  let s = text(raw, 200);
  if (!s) return null;
  s = s.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/[/?#].*$/, "");
  return /^[A-Za-z0-9._]{1,30}$/.test(s) ? s.toLowerCase() : null;
}

/** Valida y limpia lo que mandó el formulario. Sin errores, devuelve el perfil listo para guardar. */
export function validateProfile(input: ProfileInput): { ok: true; profile: CleanProfile } | { ok: false; errors: ProfileErrors } {
  const errors: ProfileErrors = {};
  const firstName = text(input.firstName, 60);
  const lastName = text(input.lastName, 60);
  if (firstName.length < 2) errors.firstName = "Escribí tu nombre.";
  if (lastName.length < 2) errors.lastName = "Escribí tu apellido.";
  const whatsapp = normalizeWhatsapp(input.whatsapp);
  if (!whatsapp) errors.whatsapp = "Escribí tu WhatsApp con código de área (por ejemplo, 341 5123456).";
  const instagramRaw = text(input.instagram, 200);
  const instagram = normalizeInstagram(instagramRaw);
  if (instagramRaw && !instagram) errors.instagram = "Ese usuario de Instagram no es válido.";
  const company = text(input.company, 120);
  if (company.length < 2) errors.company = "Escribí el nombre de tu empresa o estudio (o «Independiente»).";
  const city = text(input.city, 120);
  const latitude = Number(input.latitude);
  const longitude = Number(input.longitude);
  const located = Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 && !(latitude === 0 && longitude === 0);
  if (!city || !located) errors.city = "Elegí tu ciudad de la lista para ubicarla en el mapa.";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    profile: {
      firstName,
      lastName,
      whatsapp: whatsapp!,
      instagram,
      company,
      city,
      province: text(input.province, 120) || null,
      country: text(input.country, 80) || null,
      latitude,
      longitude,
      jobAlerts: input.jobAlerts === true,
    },
  };
}

/** Lo que ya tiene la cuenta: ¿alcanza para entrar o falta completar datos? */
export function isProfileComplete(user: {
  name: string | null;
  whatsapp: string | null;
  companyName: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
}): boolean {
  const words = (user.name ?? "").trim().split(/\s+/).filter(Boolean);
  return words.length >= 2 && !!normalizeWhatsapp(user.whatsapp) && !!user.companyName?.trim() && !!user.city?.trim() && user.latitude != null && user.longitude != null;
}

/** Nombre guardado en la cuenta → nombre y apellido (para completar el formulario). */
export function splitName(name: string | null): { firstName: string; lastName: string } {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return { firstName: words[0] ?? "", lastName: "" };
  return { firstName: words.slice(0, -1).join(" "), lastName: words[words.length - 1] };
}

// ─── Código de verificación por email ──────────────────────────────────────

/** Vigencia del código y cuántos intentos se permiten antes de pedir otro. */
export const EMAIL_CODE_TTL_MS = 15 * 60 * 1000;
export const EMAIL_CODE_MAX_ATTEMPTS = 5;
/** Entre un envío y el siguiente (para no llenar la casilla ni gastar envíos). */
export const EMAIL_CODE_RESEND_MS = 60 * 1000;

export function generateEmailCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** El código se guarda como hash, atado al email (un código no sirve para otra cuenta). */
export function hashEmailCode(email: string, code: string): string {
  return createHash("sha256").update(`${email.trim().toLowerCase()}:${code.trim()}`).digest("hex");
}

/** Lo que escribió la persona → 6 dígitos (acepta espacios o guiones entre medio). */
export function cleanEmailCode(raw: unknown): string | null {
  const d = typeof raw === "string" ? raw.replace(/\D/g, "") : "";
  return d.length === 6 ? d : null;
}
