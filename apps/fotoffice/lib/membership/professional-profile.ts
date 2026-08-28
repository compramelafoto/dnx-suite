import {
  normalizarSitioWeb,
  normalizarUrlRed,
  normalizarUsuarioRed,
  type RedPorUrl,
  type RedPorUsuario,
} from "./social";
import { parsearEspecialidades } from "./specialties";

export type PerfilProfesionalInput = {
  businessName?: string | null;
  bio?: string | null;
  specialties?: readonly string[];
  website?: string | null;
  instagram?: string | null;
  tiktok?: string | null;
  facebook?: string | null;
  youtube?: string | null;
  linkedin?: string | null;
  directoryOptIn?: boolean;
};

const MAX_BIO = 600;
const MAX_ESTUDIO = 160;

/**
 * Valida y normaliza lo que el socio edita en su portal.
 *
 * Comparte los normalizadores con el formulario público a propósito: si el alta guarda el
 * usuario de Instagram sin arroba y el portal lo guardara con arroba, el mismo socio quedaría
 * escrito de dos formas según por dónde entró.
 */
export function parsePerfilProfesional(
  raw: PerfilProfesionalInput
): { ok: true; data: Record<string, unknown> } | { ok: false; error: string; field?: string } {
  const estudio = (raw.businessName ?? "").trim();
  if (estudio.length > MAX_ESTUDIO) {
    return { ok: false, error: "El nombre del estudio es demasiado largo.", field: "businessName" };
  }
  const bio = (raw.bio ?? "").trim();
  if (bio.length > MAX_BIO) {
    return { ok: false, error: `La presentación no puede pasar de ${MAX_BIO} caracteres.`, field: "bio" };
  }

  const redes: Record<string, string | null> = {};
  for (const red of ["instagram", "tiktok"] as RedPorUsuario[]) {
    const r = normalizarUsuarioRed(red, raw[red]);
    if (!r.ok) return { ok: false, error: r.error, field: red };
    redes[red] = r.valor;
  }
  for (const red of ["facebook", "youtube", "linkedin"] as RedPorUrl[]) {
    const r = normalizarUrlRed(red, raw[red]);
    if (!r.ok) return { ok: false, error: r.error, field: red };
    redes[red] = r.valor;
  }

  const web = normalizarSitioWeb(raw.website);
  if (!web.ok) return { ok: false, error: web.error, field: "website" };

  const rubros = parsearEspecialidades(raw.specialties);
  if (!rubros.ok) return { ok: false, error: rubros.error, field: "specialties" };

  return {
    ok: true,
    data: {
      businessName: estudio || null,
      bio: bio || null,
      specialties: rubros.valor,
      website: web.valor,
      instagram: redes.instagram ?? null,
      tiktok: redes.tiktok ?? null,
      facebook: redes.facebook ?? null,
      youtube: redes.youtube ?? null,
      linkedin: redes.linkedin ?? null,
      directoryOptIn: Boolean(raw.directoryOptIn),
    },
  };
}
