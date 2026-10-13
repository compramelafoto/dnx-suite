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
  "sincorreo", "sinmail", "sinemail", "sin", "noemail", "nomail", "notiene", "notengo", "nocorreo", "no", "nn", "none", "nada", "ninguno",
  "x", "xx", "xxx", "a", "aa", "asd", "test", "ejemplo", "example", "correo", "email", "mail", "prueba", "usuario",
]);

/** ¿Es un correo que no identifica a nadie? Relleno típico, dominio de ejemplo o uno del propio estudio. */
export function esCorreoDeRelleno(mail: string, delEstudio: ReadonlySet<string> = new Set()): boolean {
  if (delEstudio.has(mail)) return true;
  const [local = "", dominio = ""] = mail.split("@");
  if (!/[a-z]/i.test(local)) return true; // 1234@…, 0@0.com
  const base = local.replace(/[\d._+-]+/g, "");
  if (LOCALES_RELLENO.has(base) || /^(sincorreo|sinmail|sinemail|noemail|nomail|notiene|notengo|ninguno|nocorreo)/.test(base)) return true;
  return /(^|\.)example\.|(^|\.)ejemplo\.|^test\.|^(x|xx|a|aa|no|nn)\.[a-z.]+$|^mail\.com$/.test(dominio);
}

/** Cantidad de contactos con nombres distintos desde la que un correo o un teléfono se considera compartido. */
export const UMBRAL_COMPARTIDO = 3;

export type NombrePersona = {
  /** Palabras del nombre completo (nombre, apellido, razón social), normalizadas y sin partículas. */
  tokens: string[];
};

/** Partículas que no distinguen a nadie ("de la Cruz", "dos Santos"). */
const PARTICULAS = new Set(["de", "del", "la", "las", "los", "y", "e", "da", "das", "do", "dos", "van", "von", "di"]);

export function nombrePersona(firstName: unknown, lastName: unknown, businessName?: unknown): NombrePersona {
  const partes = (v: unknown) => (typeof v === "string" ? clave(v).split(" ").filter((t) => t && !PARTICULAS.has(t)) : []);
  return { tokens: [...new Set([...partes(firstName), ...partes(lastName), ...partes(businessName)])] };
}

/** Versión con huellas (para guardar en el avance sin el nombre): mismas comparaciones, otros textos. */
export function nombreCifrado(p: NombrePersona, sal: string): NombrePersona {
  const h = (t: string) => createHash("sha256").update(`${sal}:${t}`).digest("hex").slice(0, 12);
  return { tokens: p.tokens.map(h) };
}

/**
 * Regla estricta: compatibles sólo si el nombre más corto tiene al menos dos palabras (nombre y apellido) y todas
 * están en el más largo (o son iguales). "Juan Pérez" ~ "Juan Carlos Pérez"; "Juan Carlos Pérez" ≁ "Juan Martín
 * Pérez"; un nombre de una sola palabra nunca es compatible con nada (ante la duda, se cargan por separado).
 */
export function nombresCompatibles(a: NombrePersona, b: NombrePersona): boolean {
  const [corto, largo] = a.tokens.length <= b.tokens.length ? [a.tokens, b.tokens] : [b.tokens, a.tokens];
  if (corto.length < 2) return false;
  const L = new Set(largo);
  return corto.every((t) => L.has(t));
}
