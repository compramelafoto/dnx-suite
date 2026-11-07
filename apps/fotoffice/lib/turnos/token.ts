import { createHash, randomBytes } from "node:crypto";

/** El token del enlace de gestión: se manda por correo y sólo se guarda su SHA-256. */
export function generarTokenDeGestion(): { token: string; hash: string } {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: hashDeToken(token) };
}

export function hashDeToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function tokenConForma(v: unknown): v is string {
  return typeof v === "string" && /^[A-Za-z0-9_-]{20,64}$/.test(v);
}
