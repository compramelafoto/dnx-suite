import { normalizeInstagram, normalizeProfileSlug, normalizeWebsite, profileSlugProblem } from "@repo/muestras";
import { baseImagenesPublicas, esImagenPropia } from "@/lib/actividades/mapear";

export const LARGOS_PERFIL = { displayName: 120, bio: 3000, city: 120, province: 120, website: 300, instagram: 80 } as const;

export type PerfilForm = {
  displayName: string;
  /** Vacío = que la acción lo arme del nombre (o conserve el que tenía). */
  slug: string;
  bio: string | null;
  city: string | null;
  province: string | null;
  website: string | null;
  instagram: string | null;
  avatarUrl: string | null;
};

export function perfilDesdeFormData(
  fd: FormData,
  opciones: { baseImagenes?: string | null } = {},
): { ok: true; perfil: PerfilForm } | { ok: false; errores: string[] } {
  const base = "baseImagenes" in opciones ? opciones.baseImagenes ?? null : baseImagenesPublicas();
  const t = (k: string, max: number) => String(fd.get(k) ?? "").trim().slice(0, max).trim();
  const errores: string[] = [];

  const displayName = t("displayName", LARGOS_PERFIL.displayName);
  if (!displayName) errores.push("Poné tu nombre como querés que aparezca.");

  const slugEscrito = t("slug", 200);
  const slug = slugEscrito ? normalizeProfileSlug(slugEscrito) : "";
  if (slugEscrito) {
    const problema = profileSlugProblem(slug);
    if (problema) errores.push(problema);
  }

  const webEscrita = t("website", LARGOS_PERFIL.website);
  const website = webEscrita ? normalizeWebsite(webEscrita) : null;
  if (webEscrita && !website) errores.push("La dirección del sitio web no es válida.");

  const igEscrito = t("instagram", LARGOS_PERFIL.instagram);
  const instagram = igEscrito ? normalizeInstagram(igEscrito) : null;
  if (igEscrito && !instagram) errores.push("El usuario de Instagram no es válido.");

  if (errores.length) return { ok: false, errores };
  const avatar = t("avatarUrl", 1000);
  return {
    ok: true,
    perfil: {
      displayName,
      slug,
      bio: t("bio", LARGOS_PERFIL.bio) || null,
      city: t("city", LARGOS_PERFIL.city) || null,
      province: t("province", LARGOS_PERFIL.province) || null,
      website,
      instagram,
      avatarUrl: avatar && esImagenPropia(avatar, base) ? avatar : null,
    },
  };
}
