/**
 * Enlace firmado para que el jurado vea una vista previa alojada en el bucket
 * privado de Clickatón.
 *
 * FotoRank no recibe las llaves del bucket: firma un enlace con el secreto
 * compartido y el navegador del jurado le pide la imagen a Clickatón. El
 * vencimiento corto hace que un enlace copiado deje de servir solo.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const PURPOSE = "clickaton:jury-preview:v1";

export function getJuryMediaSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret =
    env.CLICKATON_JURY_MEDIA_SECRET?.trim() || env.DNX_SESSION_SECRET?.trim();
  if (!secret || secret.length < 16) {
    throw new Error(
      "CLICKATON_JURY_MEDIA_SECRET (o DNX_SESSION_SECRET) es obligatorio para firmar vistas previas de jurado",
    );
  }
  return secret;
}

function computeSignature(assetId: string, expMs: number, secret: string): string {
  return createHmac("sha256", secret)
    .update(`${PURPOSE}:${assetId}:${expMs}`)
    .digest("base64url");
}

export function signJuryPreviewLink(input: {
  assetId: string;
  expiresAt: Date;
  secret?: string;
}): string {
  const secret = input.secret ?? getJuryMediaSecret();
  return computeSignature(input.assetId, input.expiresAt.getTime(), secret);
}

export type JuryPreviewLinkVerification =
  | { ok: true }
  | { ok: false; reason: "EXPIRED" | "BAD_SIGNATURE" | "MALFORMED" };

export function verifyJuryPreviewLink(input: {
  assetId: string;
  exp: string;
  sig: string;
  now?: Date;
  secret?: string;
}): JuryPreviewLinkVerification {
  const expMs = Number(input.exp);
  if (!input.assetId || !input.exp || !Number.isSafeInteger(expMs) || expMs <= 0) {
    return { ok: false, reason: "MALFORMED" };
  }

  const secret = input.secret ?? getJuryMediaSecret();
  const expected = computeSignature(input.assetId, expMs, secret);
  const a = Buffer.from(expected);
  const b = Buffer.from(input.sig ?? "");
  // Comparar siempre con el mismo costo: una comparación corta filtra información.
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "BAD_SIGNATURE" };
  }

  const now = (input.now ?? new Date()).getTime();
  // Vencimiento exclusivo: al milisegundo exacto todavía vale.
  if (expMs < now) return { ok: false, reason: "EXPIRED" };

  return { ok: true };
}

export function buildJuryPreviewPath(input: {
  assetId: string;
  expiresAt: Date;
  secret?: string;
}): string {
  const sig = signJuryPreviewLink(input);
  const qs = new URLSearchParams({
    exp: String(input.expiresAt.getTime()),
    sig,
  });
  return `/api/jurado/media/${encodeURIComponent(input.assetId)}?${qs.toString()}`;
}
