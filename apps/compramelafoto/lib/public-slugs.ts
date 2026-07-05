import { prisma } from "@/lib/prisma";

const VALID_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MIN_SLUG_LEN = 3;
const MAX_SLUG_LEN = 60;

/** Segmentos de ruta estáticos y reservados del sistema. */
export const RESERVED_PUBLIC_SLUGS = new Set([
  "a",
  "admin",
  "album",
  "api",
  "app",
  "ayuda",
  "blog",
  "camofduty",
  "charlas",
  "charlasfpr",
  "charlafotoescolar",
  "cliente",
  "comunidad",
  "cursos",
  "cuenta",
  "dashboard",
  "delete-biometric",
  "demo",
  "demo-home",
  "demo-ui",
  "directorio",
  "dnx",
  "e",
  "escuela",
  "escuelas",
  "escolar",
  "f",
  "forgot-password",
  "fotografo",
  "fotografoescolar",
  "fotocarnet",
  "fotocarnet-test",
  "fotolibro",
  "g",
  "imprimir",
  "imprimir-publico",
  "invite",
  "l",
  "lab",
  "land",
  "landescolar",
  "login",
  "order",
  "organizador",
  "organizadores",
  "pago",
  "polaroids",
  "polaroids-test",
  "privacidad",
  "public",
  "registro",
  "reset-password",
  "support",
  "terminos",
  "test",
  "testimonios",
  "tutoriales",
  "unsubscribe",
  "verify-email",
  "www",
]);

export function normalizePublicSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function validatePublicSlugFormat(slug: string): { ok: true } | { ok: false; error: string } {
  if (!slug) {
    return { ok: false, error: "El slug es requerido." };
  }
  if (slug.length < MIN_SLUG_LEN) {
    return { ok: false, error: `El slug debe tener al menos ${MIN_SLUG_LEN} caracteres.` };
  }
  if (slug.length > MAX_SLUG_LEN) {
    return { ok: false, error: `El slug no puede superar ${MAX_SLUG_LEN} caracteres.` };
  }
  if (!VALID_SLUG_REGEX.test(slug)) {
    return {
      ok: false,
      error: "Solo letras minúsculas, números y guiones (sin espacios ni guiones al inicio/fin).",
    };
  }
  if (RESERVED_PUBLIC_SLUGS.has(slug)) {
    return { ok: false, error: "Esa URL está reservada por el sistema." };
  }
  return { ok: true };
}

export type PublicSlugAvailabilityResult =
  | { available: true; normalizedSlug: string }
  | { available: false; normalizedSlug: string; reason: string };

/**
 * Verifica disponibilidad global del slug público.
 */
export async function checkPublicSlugAvailability(
  rawSlug: string,
  options?: { excludeUserId?: number; excludeProfileId?: number }
): Promise<PublicSlugAvailabilityResult> {
  const normalizedSlug = normalizePublicSlug(rawSlug);
  const format = validatePublicSlugFormat(normalizedSlug);
  if (!format.ok) {
    return { available: false, normalizedSlug, reason: format.error };
  }

  const [organizerProfile, photographer, lab] = await Promise.all([
    prisma.organizerPublicProfile.findFirst({
      where: {
        publicSlug: normalizedSlug,
        ...(options?.excludeProfileId ? { id: { not: options.excludeProfileId } } : {}),
        ...(options?.excludeUserId ? { userId: { not: options.excludeUserId } } : {}),
      },
      select: { id: true },
    }),
    prisma.user.findFirst({
      where: {
        publicPageHandler: normalizedSlug,
        ...(options?.excludeUserId ? { id: { not: options.excludeUserId } } : {}),
      },
      select: { id: true },
    }),
    prisma.lab.findFirst({
      where: { publicPageHandler: normalizedSlug },
      select: { id: true },
    }),
  ]);

  if (organizerProfile) {
    return { available: false, normalizedSlug, reason: "Ese slug ya está en uso por otro organizador." };
  }
  if (photographer) {
    return { available: false, normalizedSlug, reason: "Ese slug ya está en uso por un fotógrafo." };
  }
  if (lab) {
    return { available: false, normalizedSlug, reason: "Ese slug ya está en uso por un laboratorio." };
  }

  return { available: true, normalizedSlug };
}

/** @deprecated alias para compatibilidad con photographer-slugs */
export function isReservedPublicSlug(slug?: string | null): boolean {
  if (!slug) return false;
  return RESERVED_PUBLIC_SLUGS.has(slug.toLowerCase());
}
