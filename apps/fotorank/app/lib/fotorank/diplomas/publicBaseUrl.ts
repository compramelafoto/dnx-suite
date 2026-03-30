/* eslint-disable turbo/no-undeclared-env-vars -- URLs de verificación: vars opcionales por entorno (Vercel / .env). */

/**
 * URL pública para enlaces de verificación y QR (sin barra final).
 */
export function getFotorankPublicBaseUrl(): string {
  const explicit =
    process.env.FOTORANK_PUBLIC_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`;
  return "http://localhost:3000";
}

export function diplomaVerificationPath(token: string): string {
  return `/diplomas/verificar/${encodeURIComponent(token)}`;
}

export function buildDiplomaVerificationUrl(token: string): string {
  return `${getFotorankPublicBaseUrl()}${diplomaVerificationPath(token)}`;
}
