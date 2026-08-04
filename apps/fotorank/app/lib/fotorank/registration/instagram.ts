/** Normalización y validación de handle de Instagram en inscripción. */

const MAX_LEN = 30;

export function normalizeInstagramHandle(raw: string | null | undefined): string {
  if (raw == null) return "";
  let v = raw.trim();
  if (!v) return "";
  if (v.startsWith("@")) v = v.slice(1);
  v = v.trim();
  return v;
}

export type InstagramValidation =
  | { ok: true; handle: string }
  | { ok: false; message: string };

/**
 * Instagram obligatorio en inscripción: no vacío, sin solo espacios,
 * normaliza @ inicial, longitud 1–30 tras normalizar.
 * No exige cuenta pública.
 */
export function validateInstagramHandle(raw: string | null | undefined): InstagramValidation {
  const handle = normalizeInstagramHandle(raw);
  if (!handle) {
    return { ok: false, message: "El usuario de Instagram es obligatorio." };
  }
  if (/\s/.test(handle)) {
    return { ok: false, message: "El usuario de Instagram no puede contener espacios." };
  }
  if (handle.length < 1 || handle.length > MAX_LEN) {
    return {
      ok: false,
      message: `El usuario de Instagram debe tener entre 1 y ${MAX_LEN} caracteres (sin @).`,
    };
  }
  // Caracteres razonables de handle IG (letras, números, punto, guion bajo).
  if (!/^[A-Za-z0-9._]+$/.test(handle)) {
    return {
      ok: false,
      message: "El usuario de Instagram solo puede contener letras, números, puntos y guiones bajos.",
    };
  }
  return { ok: true, handle };
}
