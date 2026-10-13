import { createHash } from "node:crypto";
import { clave } from "./normalizar";

/**
 * Cuándo dos registros son "la misma persona". Puro.
 *
 * Un correo o un teléfono solos NO alcanzan: en un estudio real hay correos de relleno (`sincorreo@…`, el del propio
 * estudio), familias que comparten correo y parejas que comparten teléfono. Se empareja o fusiona sólo si además los
 * nombres son compatibles.
 */

/** Partes locales típicas de un correo de relleno (sin dígitos ni signos). */
const LOCALES_RELLENO = new Set([
  "sincorreo", "sinmail", "sinemail", "sin", "noemail", "nomail", "notiene", "nocorreo", "no", "none", "nada", "ninguno",
  "x", "xx", "xxx", "a", "aa", "asd", "test", "ejemplo", "example", "correo", "email", "mail", "prueba", "usuario",
]);

/** ¿Es un correo que no identifica a nadie? Relleno típico, dominio de ejemplo o uno del propio estudio. */
export function esCorreoDeRelleno(mail: string, delEstudio: ReadonlySet<string> = new Set()): boolean {
  if (delEstudio.has(mail)) return true;
  const [local = "", dominio = ""] = mail.split("@");
  const base = local.replace(/[\d._+-]+/g, "");
  if (LOCALES_RELLENO.has(base) || base.startsWith("sincorreo") || base.startsWith("sinmail") || base.startsWith("noemail") || base.startsWith("notiene")) return true;
  return /(^|\.)example\.|(^|\.)ejemplo\.|^test\.|^x\.com$|^no\.com$|^mail\.com$/.test(dominio);
}

/** Cantidad de contactos con nombres distintos desde la que un correo o un teléfono se considera compartido. */
export const UMBRAL_COMPARTIDO = 3;

export type NombrePersona = {
  /** Todas las palabras del nombre completo (nombre, apellido, razón social), normalizadas. */
  tokens: string[];
  /** Primera palabra del nombre + primera del apellido. */
  nucleo: string[];
};

export function nombrePersona(firstName: unknown, lastName: unknown, businessName?: unknown): NombrePersona {
  const partes = (v: unknown) => (typeof v === "string" ? clave(v).split(" ").filter(Boolean) : []);
  const n = partes(firstName);
  const a = partes(lastName);
  const tokens = [...new Set([...n, ...a, ...partes(businessName)])];
  const nucleo = n[0] && a[0] ? [n[0], a[0]] : [];
  return { tokens, nucleo };
}

/** Versión con huellas (para guardar en el avance sin el nombre): mismas comparaciones, otros textos. */
export function nombreCifrado(p: NombrePersona, sal: string): NombrePersona {
  const h = (t: string) => createHash("sha256").update(`${sal}:${t}`).digest("hex").slice(0, 12);
  return { tokens: p.tokens.map(h), nucleo: p.nucleo.map(h) };
}

/**
 * Compatibles: mismo nombre completo, o uno contiene el nombre + apellido (núcleo) del otro, o se parecen en al menos
 * 60 % de las palabras (Jaccard). Sin nombre de un lado → no compatibles (no hay con qué comprobar).
 */
export function nombresCompatibles(a: NombrePersona, b: NombrePersona): boolean {
  if (a.tokens.length === 0 || b.tokens.length === 0) return false;
  const A = new Set(a.tokens);
  const B = new Set(b.tokens);
  const iguales = A.size === B.size && [...A].every((t) => B.has(t));
  if (iguales) return true;
  if (b.nucleo.length > 0 && b.nucleo.every((t) => A.has(t))) return true;
  if (a.nucleo.length > 0 && a.nucleo.every((t) => B.has(t))) return true;
  const inter = [...A].filter((t) => B.has(t)).length;
  return inter / new Set([...A, ...B]).size >= 0.6;
}
