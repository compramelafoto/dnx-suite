/**
 * Curso presencial DNX · Fotografía básica (Funes).
 * En **producción** el cobro usa solo `MP_ACCESS_TOKEN` (cuenta aplicación ComprameLaFoto, mismo que `lib/mercadopago` sin override).
 * En desarrollo/preview local: `MP_ACCESS_TOKEN` + legacy `DNX_*` + OAuth admin como último recurso.
 */

import { Role } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";

export const DNX_FOTO_BASICA_FUNES_SLUG = "fotografia-basica-funes" as const;

/** Clave interna para cupos e inscripciones (no cambiar si hay filas en producción). */
export const DNX_FOTO_BASICA_FUNES_COURSE_KEY = "dnx-foto-basica-funes-2025-06-06" as const;

export const DNX_FOTO_BASICA_FUNES_MAX_SEATS = 12;
export const DNX_FOTO_BASICA_FUNES_PRICE_ARS = 150_000;

/** Tiempo que una inscripción PENDING reserva cupo para evitar sobrecarga simultánea */
export const DNX_FOTO_BASICA_PENDING_HOLD_MS = 45 * 60 * 1000;

export function isDnxFotoBasicaFunesSlug(slug: string): boolean {
  return slug.trim() === DNX_FOTO_BASICA_FUNES_SLUG;
}

export function normalizeDnxEnrollmentEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Solo variables de entorno (sin DB). Para checkout/webhook usar `resolveDnxCourseMpAccessToken`. */
export function getDnxCourseMpAccessToken(): string | null {
  const platform = process.env.MP_ACCESS_TOKEN?.trim();
  if (platform) return platform;
  const fallbackKeys = ["DNX_COURSE_MP_ACCESS_TOKEN", "DNX_SUITE_MP_ACCESS_TOKEN"] as const;
  for (const key of fallbackKeys) {
    const t = process.env[key]?.trim();
    if (t) return t;
  }
  return null;
}

/**
 * Token MP para el curso.
 * **Producción (`NODE_ENV`):** solo `MP_ACCESS_TOKEN` (APP_USR-…), igual que la API central sin override — no fotógrafo, no OAuth admin.
 * **No producción:** `getDnxCourseMpAccessToken` y luego OAuth admin si falta env.
 */
export async function resolveDnxCourseMpAccessToken(): Promise<string | null> {
  if (process.env.NODE_ENV === "production") {
    const t = process.env.MP_ACCESS_TOKEN?.trim();
    return t && t.length > 0 ? t : null;
  }

  const envTok = getDnxCourseMpAccessToken();
  if (envTok) return envTok;

  const adminEmail = process.env.ADMIN_EMAIL?.trim();
  if (adminEmail) {
    const byEmail = await prisma.user.findFirst({
      where: { email: adminEmail, role: Role.ADMIN },
      select: { mpAccessToken: true },
    });
    const t = byEmail?.mpAccessToken?.trim();
    if (t) return t;
  }
  const anyAdmin = await prisma.user.findFirst({
    where: { role: Role.ADMIN, mpAccessToken: { not: null } },
    orderBy: { id: "asc" },
    select: { mpAccessToken: true },
  });
  const oauth = anyAdmin?.mpAccessToken?.trim();
  if (oauth) return oauth;
  return null;
}

/** @deprecated Usar getDnxCourseMpAccessToken (env) o resolveDnxCourseMpAccessToken (checkout) */
export const getDnxSuiteCourseMpAccessToken = getDnxCourseMpAccessToken;

/** Logs servidor: nunca incluye el token. */
export function logDnxCourseMpTokenMissing(context: string, extra?: Record<string, unknown>): void {
  const checkedEnvVars = [
    "MP_ACCESS_TOKEN",
    "DNX_COURSE_MP_ACCESS_TOKEN",
    "DNX_SUITE_MP_ACCESS_TOKEN",
  ] as const;
  console.error(`[dnx-course/mp] ${context}: cobro no configurado — falta Access Token de Mercado Pago.`, {
    checkedEnvVars: [...checkedEnvVars],
    courseKey: DNX_FOTO_BASICA_FUNES_COURSE_KEY,
    slug: DNX_FOTO_BASICA_FUNES_SLUG,
    priceArs: DNX_FOTO_BASICA_FUNES_PRICE_ARS,
    hint:
      "En producción definí solo MP_ACCESS_TOKEN con Access Token de producción (APP_USR-…). En local podés usar OAuth admin o variables legacy DNX_*.",
    ...extra,
  });
}

/** WhatsApp del organizador (curso Funes). Formato internacional sin + para wa.me */
export const DNX_FUNES_COURSE_WHATSAPP_PHONE_DEFAULT = "5493413748324";

const DNX_FUNES_LANDING_WHATSAPP_PREFILL =
  "Hola Daniel, te escribo desde la landing del Curso de Fotografía Básica en Funes (ComprameLaFoto). Quería consultarte:";

/**
 * Enlace wa.me con texto precargado (origen landing). Si definís `NEXT_PUBLIC_DNX_FUNES_COURSE_WHATSAPP_URL`,
 * se usa esa URL tal cual (reemplazo total).
 */
export function getDnxFotoBasicaFunesWhatsAppUrl(): string {
  const direct = process.env.NEXT_PUBLIC_DNX_FUNES_COURSE_WHATSAPP_URL?.trim();
  if (direct) return direct;
  const phoneDigits = (process.env.NEXT_PUBLIC_DNX_FUNES_COURSE_WHATSAPP_PHONE ?? "").replace(/\D/g, "");
  const phone =
    phoneDigits.length >= 10 ? phoneDigits : DNX_FUNES_COURSE_WHATSAPP_PHONE_DEFAULT;
  const text = encodeURIComponent(DNX_FUNES_LANDING_WHATSAPP_PREFILL);
  return `https://wa.me/${phone}?text=${text}`;
}
