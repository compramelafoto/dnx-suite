/**
 * Enlaces firmados a la imagen de una obra de FotoRank. Módulo PURO (sólo `node:crypto`).
 *
 * ATENCIÓN: este archivo vive COPIADO, idéntico, en dos apps:
 *   - apps/fotoffice/lib/store/artworks/signing.ts
 *   - apps/fotorank/app/lib/fotorank/external/entry-image-signing.ts
 * No hay paquete compartido para esto. Si cambiás uno, cambiá el otro; el vector fijo de
 * los tests de ambas apps avisa si se separan.
 *
 * La firma es HMAC-SHA256 (base64url) sobre `entryId|variant|exp|wm`, donde `exp` son
 * segundos unix y `wm` el texto de la marca de agua (vacío si no hay). Como `|` es el
 * separador, no se acepta dentro de `entryId` ni de `wm` (firmar tira `BAD_PARAMS`;
 * verificar devuelve `BAD_PARAMS`): así dos combinaciones distintas nunca dan el mismo texto.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export type EntryImageVariant = "preview" | "original";

export type EntryImageSignatureParams = {
  entryId: string;
  variant: string;
  exp: number;
  wm: string | null | undefined;
  sig: string;
};

export type EntryImageVerification =
  | { ok: true }
  | { ok: false; reason: "BAD_SIGNATURE" | "EXPIRED" | "BAD_PARAMS" };

function esVariante(v: string): v is EntryImageVariant {
  return v === "preview" || v === "original";
}

const SEPARADOR = "|";

function tieneSeparador(v: string | null | undefined): boolean {
  return typeof v === "string" && v.includes(SEPARADOR);
}

function firmar(entryId: string, variant: string, exp: number, wm: string | null | undefined, secret: string): string {
  const payload = `${entryId}|${variant}|${exp}|${wm ?? ""}`;
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function signEntryImageUrl(input: {
  baseUrl: string;
  entryId: string;
  variant: EntryImageVariant;
  expiresAt: Date;
  secret: string;
  wm?: string | null;
}): string {
  if (tieneSeparador(input.entryId) || tieneSeparador(input.wm)) {
    throw new Error("BAD_PARAMS: entryId y wm no pueden contener «|».");
  }
  const exp = Math.floor(input.expiresAt.getTime() / 1000);
  const wm = input.wm ?? "";
  const sig = firmar(input.entryId, input.variant, exp, wm, input.secret);
  const base = input.baseUrl.replace(/\/+$/, "");
  const campos: [string, string][] = [
    ["entryId", input.entryId],
    ["variant", input.variant],
    ["exp", String(exp)],
    ["wm", wm],
    ["sig", sig],
  ];
  const q = campos.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
  return `${base}/api/fotorank/external/entry-image?${q}`;
}

export function verifyEntryImageSignature(
  params: EntryImageSignatureParams,
  secret: string,
  now: Date,
): EntryImageVerification {
  if (
    !secret ||
    !params.entryId ||
    !params.sig ||
    tieneSeparador(params.entryId) ||
    tieneSeparador(params.wm) ||
    !esVariante(params.variant) ||
    !Number.isInteger(params.exp)
  ) {
    return { ok: false, reason: "BAD_PARAMS" };
  }
  const esperada = Buffer.from(firmar(params.entryId, params.variant, params.exp, params.wm, secret));
  const recibida = Buffer.from(params.sig);
  const coincide = esperada.length === recibida.length && timingSafeEqual(esperada, recibida);
  if (!coincide) return { ok: false, reason: "BAD_SIGNATURE" };
  if (Math.floor(now.getTime() / 1000) > params.exp) return { ok: false, reason: "EXPIRED" };
  return { ok: true };
}
