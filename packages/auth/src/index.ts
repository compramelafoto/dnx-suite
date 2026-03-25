import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@repo/db";

export const DNX_SESSION_COOKIE = "dnx_session";
export const DNX_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function hashSessionToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export async function createUserSession(userId: number) {
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashSessionToken(rawToken);
  const expiresAt = new Date(Date.now() + DNX_SESSION_MAX_AGE_SECONDS * 1000);

  await prisma.userSession.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  return {
    rawToken,
    expiresAt,
    maxAge: DNX_SESSION_MAX_AGE_SECONDS,
    cookieName: DNX_SESSION_COOKIE,
  };
}

export async function getSessionUserByRawToken(rawToken: string) {
  const tokenHash = hashSessionToken(rawToken);

  const session = await prisma.userSession.findUnique({
    where: { tokenHash },
    include: {
      user: true,
    },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.userSession.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  return session.user;
}

export async function destroyUserSessionByRawToken(rawToken: string) {
  const tokenHash = hashSessionToken(rawToken);
  await prisma.userSession.deleteMany({
    where: { tokenHash },
  });
}

export async function revokeAllUserSessions(userId: number) {
  await prisma.userSession.deleteMany({
    where: { userId },
  });
}
