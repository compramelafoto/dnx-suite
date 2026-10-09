/** Huella SHA-256 (hexadecimal, 64 caracteres en minúscula). Módulo PURO. */
import { createHash } from "node:crypto";

const FORMA_HUELLA = /^[0-9a-f]{64}$/;

/** Huella del texto en UTF-8: la del `bodyText` final de una versión, calculada al enviar. */
export function huellaTexto(texto: string): string {
  return createHash("sha256").update(texto, "utf8").digest("hex");
}

/** Huella de unos bytes (el PDF final tiene la suya, aparte de la del texto). */
export function huellaBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function esHuella(v: unknown): v is string {
  return typeof v === "string" && FORMA_HUELLA.test(v);
}
