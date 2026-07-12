import { randomBytes } from "node:crypto";
import { prisma } from "./prisma";
import { hashOpaqueToken } from "./password";

export const DNX_SESSION_COOKIE = "dnx_session";
/** Sesión normal: 7 días. */
export const DNX_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
/** Recordarme: 30 días. */
export const DNX_SESSION_REMEMBER_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function hashSessionToken(rawToken: string): string {
  return hashOpaqueToken(rawToken);
}

export async function createUserSession(
  userId: number,
  options?: { rememberMe?: boolean; maxAgeSeconds?: number },
) {
  const maxAge =
    options?.maxAgeSeconds ??
    (options?.rememberMe
      ? DNX_SESSION_REMEMBER_MAX_AGE_SECONDS
      : DNX_SESSION_MAX_AGE_SECONDS);
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashSessionToken(rawToken);
  const expiresAt = new Date(Date.now() + maxAge * 1000);

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
    maxAge,
    cookieName: DNX_SESSION_COOKIE,
  };
}

export type SessionUser = {
  id: number;
  email: string;
  name: string | null;
  role: string;
  isBlocked?: boolean;
  emailVerifiedAt?: Date | null;
  globalRole?: string | null;
  logoUrl?: string | null;
};

export async function getSessionUserByRawToken(rawToken: string): Promise<SessionUser | null> {
  const tokenHash = hashSessionToken(rawToken);

  const session = (await prisma.userSession.findUnique({
    where: { tokenHash },
    include: {
      user: true,
    },
  })) as { id: number; expiresAt: Date; user: Record<string, unknown> } | null;

  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.userSession.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  return session.user as SessionUser;
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
  const session = (await prisma.userSession.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
    },
  })) as {
    expiresAt: Date;
    user: { id: number; email: string; role: string; globalRole?: string | null };
  } | null;
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;

  const userId = session.user.id;

  /** Delegates opcionales: el schema monorepo puede no tener aún tablas de workspace. */
  async function safeFindMany(
    delegateName: "workspaceMembership" | "membership" | "workspaceAppAccess",
    args: unknown,
  ): Promise<Array<Record<string, unknown>>> {
    const client = prisma as unknown as Record<
      string,
      { findMany?: (a: unknown) => Promise<unknown> } | undefined
    >;
    const delegate = client[delegateName];
    if (typeof delegate?.findMany !== "function") return [];
    try {
      const rows = await delegate.findMany(args);
      return Array.isArray(rows) ? (rows as Array<Record<string, unknown>>) : [];
    } catch (err) {
      console.error(`[auth] ${delegateName}.findMany failed:`, err);
      return [];
    }
  }

  const unifiedMemberships = (await safeFindMany("workspaceMembership", {
    where: { userId },
    select: { workspaceId: true, role: true },
    orderBy: { createdAt: "asc" },
  })) as Array<{ workspaceId: string; role: string }>;

  const fallbackMemberships =
    unifiedMemberships.length > 0
      ? []
      : ((await safeFindMany("membership", {
          where: { userId },
          select: { workspaceId: true, role: true },
          orderBy: { id: "asc" },
        })) as Array<{ workspaceId: string; role: string }>);

  const workspaces =
    unifiedMemberships.length > 0
      ? unifiedMemberships.map((m: { workspaceId: string; role: string }) => ({
          workspaceId: m.workspaceId,
          workspaceRole: m.role,
        }))
      : fallbackMemberships.map((m: { workspaceId: string; role: string }) => ({
          workspaceId: m.workspaceId,
          workspaceRole: m.role === "ADMIN" ? "WORKSPACE_OWNER" : "STAFF",
        }));

  const requestedWorkspaceId = params?.currentWorkspaceId ?? null;
  const currentWorkspaceId =
    requestedWorkspaceId && workspaces.some((w: { workspaceId: string }) => w.workspaceId === requestedWorkspaceId)
      ? requestedWorkspaceId
      : null;
  const workspaceRole =
    workspaces.find((w: { workspaceId: string; workspaceRole: string }) => w.workspaceId === currentWorkspaceId)
      ?.workspaceRole ?? null;

  const appAccess = currentWorkspaceId
    ? ((await safeFindMany("workspaceAppAccess", {
        where: { userId, workspaceId: currentWorkspaceId },
        select: { app: true, enabled: true, appRole: true },
        orderBy: { app: "asc" },
      })) as Array<{ app: string; enabled: boolean; appRole: string | null }>)
    : [];

  return {
    userId,
    email: session.user.email,
    globalRole:
      session.user.globalRole ?? (session.user.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "USER"),
    currentWorkspaceId,
    workspaceRole,
    appAccess: appAccess.map((a: { app: string; enabled: boolean; appRole: string | null }) => ({
      app: a.app,
      enabled: a.enabled,
      appRole: a.appRole,
    })),
    workspaces,
  };
}
