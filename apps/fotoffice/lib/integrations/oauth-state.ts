import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@repo/db";

/**
 * El `state` del ida y vuelta con Google.
 *
 * Va en la base y no solo en una cookie porque tiene que llevar información: a qué
 * workspace y a qué integración corresponde el retorno. Un valor opaco en la URL más una
 * fila que solo el servidor puede leer es lo que impide que alguien arme un retorno falso.
 *
 * Se usa una sola vez y vence a los diez minutos.
 */

const STATE_BYTES = 24;
const TTL_MINUTES = 10;

/** Solo paths relativos internos (anti open-redirect). Mismo criterio que `google-login.ts`. */
function safeInternalPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  if (value.includes("://")) return null;
  if (value.includes("\\")) return null;
  return value.slice(0, 512);
}

export async function createOAuthState(input: {
  workspaceId: string;
  integrationKey: string;
  userId: number;
  redirectPath?: string;
}): Promise<string> {
  const state = randomBytes(STATE_BYTES).toString("base64url");
  await prisma.workspaceIntegrationOAuthState.create({
    data: {
      state,
      workspaceId: input.workspaceId,
      integrationKey: input.integrationKey,
      userId: input.userId,
      redirectPath: safeInternalPath(input.redirectPath),
      expiresAt: new Date(Date.now() + TTL_MINUTES * 60 * 1000),
    },
  });
  return state;
}

export async function consumeOAuthState(
  state: string,
  now: Date = new Date(),
): Promise<{
  workspaceId: string;
  integrationKey: string;
  userId: number;
  redirectPath: string | null;
} | null> {
  const row = (await prisma.workspaceIntegrationOAuthState.findUnique({
    where: { state },
  })) as {
    workspaceId: string;
    integrationKey: string;
    userId: number;
    redirectPath: string | null;
    expiresAt: Date;
  } | null;
  if (!row) return null;

  // Se borra siempre, valga o no: un estado leído ya no puede volver a usarse.
  await prisma.workspaceIntegrationOAuthState.delete({ where: { state } }).catch(() => undefined);

  if (row.expiresAt.getTime() <= now.getTime()) return null;

  return {
    workspaceId: row.workspaceId,
    integrationKey: row.integrationKey,
    userId: row.userId,
    redirectPath: safeInternalPath(row.redirectPath),
  };
}

/** Limpieza de estados vencidos. La puede llamar cualquier proceso; es idempotente. */
export async function purgeExpiredOAuthStates(now: Date = new Date()): Promise<number> {
  const r = await prisma.workspaceIntegrationOAuthState.deleteMany({
    where: { expiresAt: { lte: now } },
  });
  return r.count;
}
