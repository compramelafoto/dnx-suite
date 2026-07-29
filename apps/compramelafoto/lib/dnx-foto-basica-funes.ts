/**
 * Curso presencial DNX · Fotografía básica (Funes) — helpers server-only.
 * En **producción** el cobro usa solo `MP_ACCESS_TOKEN` (cuenta aplicación ComprameLaFoto).
 * Constantes públicas: `./dnx-foto-basica-funes-public`.
 */

import { Role } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import {
  DNX_FOTO_BASICA_FUNES_COURSE_KEY,
  DNX_FOTO_BASICA_FUNES_PRICE_ARS,
  DNX_FOTO_BASICA_FUNES_SLUG,
} from "./dnx-foto-basica-funes-public";

export {
  DNX_FOTO_BASICA_FUNES_SLUG,
  DNX_FOTO_BASICA_FUNES_COURSE_KEY,
  DNX_FOTO_BASICA_FUNES_MAX_SEATS,
  DNX_FOTO_BASICA_FUNES_PRICE_ARS,
  DNX_FOTO_BASICA_PENDING_HOLD_MS,
  isDnxFotoBasicaFunesSlug,
  normalizeDnxEnrollmentEmail,
  DNX_FUNES_COURSE_WHATSAPP_PHONE_DEFAULT,
  getDnxFotoBasicaFunesWhatsAppUrl,
} from "./dnx-foto-basica-funes-public";

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
 * **Producción (`NODE_ENV`):** solo `MP_ACCESS_TOKEN`.
 * **No producción:** env + OAuth admin si falta.
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
