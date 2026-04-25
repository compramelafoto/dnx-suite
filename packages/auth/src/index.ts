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

export type IdentityAppAccess = {
  app: string;
  enabled: boolean;
  appRole: string | null;
};

export type IdentityWorkspace = {
  workspaceId: string;
  workspaceRole: string;
};

export type SessionIdentityContext = {
  userId: number;
  email: string;
  globalRole: string;
  currentWorkspaceId: string | null;
  workspaceRole: string | null;
  appAccess: IdentityAppAccess[];
  workspaces: IdentityWorkspace[];
};

/**
 * Contexto unificado de identidad para toda la suite.
 * Prioriza tablas nuevas (`WorkspaceMembership`, `WorkspaceAppAccess`) y,
 * si no existen datos, cae a `Membership` legacy para compatibilidad.
 */
export async function getSessionIdentityByRawToken(
  rawToken: string,
  params?: { currentWorkspaceId?: string | null },
): Promise<SessionIdentityContext | null> {
  const tokenHash = hashSessionToken(rawToken);
  const session = await prisma.userSession.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          globalRole: true,
          role: true,
        },
      },
    },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;

  const userId = session.user.id;
  const unifiedMemberships = await prisma.workspaceMembership.findMany({
    where: { userId },
    select: { workspaceId: true, role: true },
    orderBy: { createdAt: "asc" },
  });

  const fallbackMemberships =
    unifiedMemberships.length > 0
      ? []
      : await prisma.membership.findMany({
          where: { userId },
          select: { workspaceId: true, role: true },
          orderBy: { id: "asc" },
        });

  const workspaces =
    unifiedMemberships.length > 0
      ? unifiedMemberships.map((m) => ({
          workspaceId: m.workspaceId,
          workspaceRole: m.role,
        }))
      : fallbackMemberships.map((m) => ({
          workspaceId: m.workspaceId,
          workspaceRole: m.role === "ADMIN" ? "WORKSPACE_OWNER" : "STAFF",
        }));

  const requestedWorkspaceId = params?.currentWorkspaceId ?? null;
  // Explicit workspace selection only: no implicit "first workspace" fallback.
  const currentWorkspaceId =
    requestedWorkspaceId && workspaces.some((w) => w.workspaceId === requestedWorkspaceId)
      ? requestedWorkspaceId
      : null;
  const workspaceRole = workspaces.find((w) => w.workspaceId === currentWorkspaceId)?.workspaceRole ?? null;

  const appAccess = currentWorkspaceId
    ? await prisma.workspaceAppAccess.findMany({
        where: { userId, workspaceId: currentWorkspaceId },
        select: { app: true, enabled: true, appRole: true },
        orderBy: { app: "asc" },
      })
    : [];

  return {
    userId,
    email: session.user.email,
    globalRole: session.user.globalRole ?? (session.user.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "USER"),
    currentWorkspaceId,
    workspaceRole,
    appAccess: appAccess.map((a) => ({ app: a.app, enabled: a.enabled, appRole: a.appRole })),
    workspaces,
  };
}
