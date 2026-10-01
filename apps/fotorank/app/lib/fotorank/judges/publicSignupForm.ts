/**
 * Validación de la postulación pública a jurado.
 *
 * Lo obligatorio es lo que hace que la ficha sirva para contratar a alguien.
 * Sin eso el directorio se llena de perfiles que nadie puede evaluar.
 */
export const BIO_MINIMA = 120;
export const PASSWORD_MINIMA = 8;
export const SEGUNDOS_MINIMOS_DE_LLENADO = 3;
export const EXPERIENCIA_MAXIMA = 80;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type DatosDePostulacion = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  city: string;
  country: string;
  professionalHeadline: string;
  shortBio: string;
  specialtiesText: string;
  experienceYears: number | null;
  aceptaTerminos: boolean;
  aceptaDatos: boolean;
  phone?: string;
  website?: string;
  instagram?: string;
  portfolioUrl?: string;
  languagesText?: string;
  region?: string;
  wantsDirectoryListing?: boolean;
  /** Campo invisible: si viene lleno, lo llenó un robot. */
  trampa?: string;
  segundosDeLlenado?: number;
};

export type ErroresDePostulacion = Partial<Record<keyof DatosDePostulacion, string>> & {
  _general?: string;
};

const OBLIGATORIOS: Array<{ campo: keyof DatosDePostulacion; error: string }> = [
  { campo: "firstName", error: "Poné tu nombre." },
  { campo: "lastName", error: "Poné tu apellido." },
  { campo: "email", error: "Poné tu correo." },
  { campo: "city", error: "Poné tu ciudad." },
  { campo: "country", error: "Poné tu país." },
  { campo: "professionalHeadline", error: "Poné en una línea a qué te dedicás." },
  { campo: "specialtiesText", error: "Elegí al menos una especialidad." },
];

export function validarPostulacion(
  d: DatosDePostulacion,
): { ok: true } | { ok: false; errores: ErroresDePostulacion } {
  // Un robot no merece explicaciones: el mismo mensaje para los dos casos, y
  // nada que le diga qué lo delató.
  const sospechoso =
    !!d.trampa?.trim() ||
    (d.segundosDeLlenado !== undefined && d.segundosDeLlenado < SEGUNDOS_MINIMOS_DE_LLENADO);
  if (sospechoso) {
    return { ok: false, errores: { _general: "No pudimos procesar el formulario. Probá de nuevo." } };
  }

  const errores: ErroresDePostulacion = {};

  for (const { campo, error } of OBLIGATORIOS) {
    const valor = d[campo];
    if (typeof valor !== "string" || !valor.trim()) errores[campo] = error;
  }

  if (!errores.email && !EMAIL_RE.test(d.email.trim())) {
    errores.email = "Ese correo no parece válido.";
  }

  if (d.password.length < PASSWORD_MINIMA) {
    errores.password = `La contraseña necesita al menos ${PASSWORD_MINIMA} caracteres.`;
  }

  if (d.shortBio.trim().length < BIO_MINIMA) {
    errores.shortBio = `Contá un poco más: al menos ${BIO_MINIMA} caracteres.`;
  }

  if (
    d.experienceYears === null ||
    !Number.isInteger(d.experienceYears) ||
    d.experienceYears < 0 ||
    d.experienceYears > EXPERIENCIA_MAXIMA
  ) {
    errores.experienceYears = `Poné cuántos años hace que trabajás, entre 0 y ${EXPERIENCIA_MAXIMA}.`;
  }

  if (!d.aceptaTerminos) errores.aceptaTerminos = "Hay que aceptar los términos.";
  if (!d.aceptaDatos) errores.aceptaDatos = "Hay que aceptar el tratamiento de tus datos.";

  return Object.keys(errores).length === 0 ? { ok: true } : { ok: false, errores };
}

/** Devuelve el usuario sin arroba ni dominio, o null. */
export function normalizarInstagram(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  s = s.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  s = s.replace(/^instagram\.com\//i, "");
  s = s.replace(/^@+/, "").replace(/\/+$/, "").trim();
  if (!s || /[<>\s/]/.test(s)) return null;
  return s;
}

/** Sólo http y https. Sin protocolo, se asume https. */
export function normalizarUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  // Se agrega el protocolo sólo si no hay NINGUNO: así "javascript:..." no se
  // convierte en "https://javascript:...".
  const candidato = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`;
  let url: URL;
  try {
    url = new URL(candidato);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname) return null;
  return url.toString();
}

/** "retrato, documental" → ["retrato", "documental"]. */
export function parsearLista(raw: string): string[] {
  return raw
    .split(/[,;\n]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}
