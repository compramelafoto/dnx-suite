import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

/** Link personal del mail de respuesta: abre el caso en el DNX Bot. En la base sólo queda el hash. */
export const TOKEN_CASO_DURA_MS = 30 * 86_400_000;

const ROLES_FOTOGRAFO = new Set(["PHOTOGRAPHER", "LAB_PHOTOGRAPHER"]);

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function crearTokenCaso(ticketId: number, now: Date = new Date()): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + TOKEN_CASO_DURA_MS);
  await prisma.supportCaseToken.create({ data: { ticketId, tokenHash: hashToken(token), expiresAt } });
  return { token, expiresAt };
}

export async function leerTokenCaso(token: string, now: Date = new Date()): Promise<{ ticketId: number } | null> {
  if (!token || token.length > 200) return null;
  const fila = await prisma.supportCaseToken.findUnique({ where: { tokenHash: hashToken(token) }, select: { ticketId: true, expiresAt: true } });
  if (!fila || fila.expiresAt.getTime() <= now.getTime()) return null;
  return { ticketId: fila.ticketId };
}

/** Mismo origen que getSupportUrlForRole. */
function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://compramelafoto.com").replace(/\/$/, "");
}

export function urlDeCaso(token: string, requesterRole: string | null): string {
  const t = encodeURIComponent(token);
  return requesterRole && ROLES_FOTOGRAFO.has(requesterRole)
    ? `${baseUrl()}/fotografo/soporte?dnxbot_caso=${t}`
    : `${baseUrl()}/caso/${t}`;
}
