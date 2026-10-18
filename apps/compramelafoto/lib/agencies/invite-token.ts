import { randomBytes } from "crypto";
import { hashToken } from "@/lib/token-hash";

/** El token sólo se muestra al generarlo; en la base queda el hash. */
export function createInviteToken(): { token: string; tokenHash: string } {
  const token = randomBytes(24).toString("hex");
  return { token, tokenHash: hashToken(token) };
}

export function buildInviteUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/agencias/unirse?token=${token}`;
}

/** Misma regla que `resolveAppUrl` de las invitaciones escolares, sin arrastrar sus imports de correo. */
export function appBaseUrl(): string {
  const raw =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "";
  if (!raw) return "http://localhost:3000";
  return raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`;
}
