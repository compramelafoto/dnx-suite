/**
 * Normalización y cifrado de correos para públicos personalizados de Meta.
 *
 * Meta pide: sacar espacios, pasar a minúsculas y cifrar con SHA-256 (hex).
 * No se tocan puntos ni "+etiquetas" de Gmail: Meta no lo hace del lado suyo
 * y alterarlos bajaría la coincidencia.
 */
import { createHash } from "node:crypto";

const PATRON_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Devuelve el correo normalizado, o null si no parece un correo usable. */
export function normalizarCorreo(crudo: string | null | undefined): string | null {
  if (!crudo) return null;
  const limpio = crudo.trim().toLowerCase();
  if (!PATRON_CORREO.test(limpio)) return null;
  // Dominios mal tipeados que ya aparecieron en la base (p. ej. ".con").
  if (/\.(con|cmo|comm)$/.test(limpio)) return null;
  return limpio;
}

export function sha256(valor: string): string {
  return createHash("sha256").update(valor, "utf8").digest("hex");
}

/**
 * Normaliza, descarta inválidos, quita duplicados y cifra.
 * Nunca devuelve texto plano.
 */
export function cifrarLista(correos: Iterable<string | null | undefined>): string[] {
  const vistos = new Set<string>();
  for (const c of correos) {
    const n = normalizarCorreo(c);
    if (n) vistos.add(n);
  }
  return [...vistos].map(sha256).sort();
}

/** CSV con las columnas que reconoce el Administrador de públicos ("email", "country"). */
export function armarCsv(hashes: string[]): string {
  const pais = sha256("ar");
  return ["email,country", ...hashes.map((h) => `${h},${pais}`)].join("\n") + "\n";
}
