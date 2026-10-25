import { randomBytes } from "node:crypto";
import { hashToken } from "@/lib/token-hash";

/**
 * El enlace sin cuenta que recibe el colegio para ponerle nombre a los retratos que nadie compró.
 * Se guarda sólo el hash (como los accesos a los packs) y vence a los 15 días.
 */
export const DIAS_DEL_ENLACE_DEL_COLEGIO = 15;

export function nuevoTokenDelColegio(ahora = new Date()): { token: string; hash: string; vence: Date } {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    hash: hashToken(token),
    vence: new Date(ahora.getTime() + DIAS_DEL_ENLACE_DEL_COLEGIO * 24 * 60 * 60 * 1000),
  };
}

export function hashDelTokenDelColegio(token: string): string {
  return hashToken(token.trim());
}

/** Maestra, directora, auxiliar…: lo que se guarda en `AlbumCourseMosaic.staffJson`. */
export type IntegranteDelCurso = { role: string; name: string; photoId: number | null };

export function leerIntegrantes(raw: unknown): IntegranteDelCurso[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((x) => {
    if (!x || typeof x !== "object") return [];
    const r = x as Record<string, unknown>;
    const role = typeof r.role === "string" ? r.role.trim().slice(0, 60) : "";
    const name = typeof r.name === "string" ? r.name.trim().slice(0, 120) : "";
    const photoId = typeof r.photoId === "number" && Number.isInteger(r.photoId) && r.photoId > 0 ? r.photoId : null;
    return role || name || photoId ? [{ role: role || "Docente", name, photoId }] : [];
  });
}

export function leerIdsDeFotos(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((x): x is number => typeof x === "number" && Number.isInteger(x) && x > 0))];
}
