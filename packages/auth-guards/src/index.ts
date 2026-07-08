import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  DNX_SESSION_COOKIE,
  getSessionIdentityByRawToken,
  getSessionUserByRawToken,
  type IdentityAppAccess,
} from "@repo/auth";
import { prisma } from "./prisma";

const KNOWN_WORKSPACE_COOKIE_NAMES = [
  "fotoffice_workspace_id",
  "fotorank_workspace_id",
  "compramelafoto_workspace_id",
] as const;

type WorkspaceRole = "WORKSPACE_OWNER" | "WORKSPACE_ADMIN" | "STAFF";

export type CurrentUser = {
  id: number;
  name: string | null;
  email: string;
  role: string;
  globalRole: string;
  currentWorkspaceId: string | null;
  workspaceRole: string | null;
  appAccess: IdentityAppAccess[];
};

export type WorkspaceSummary = {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
};

export type WorkspaceMembershipSummary = {
  id: string;
  userId: number;
  workspaceId: string;
  role: WorkspaceRole;
  createdAt: Date;
  updatedAt: Date;
};

export type WorkspaceContext = {
  workspace: WorkspaceSummary;
  membership: WorkspaceMembershipSummary;
};

export type CurrentWorkspaceOptions = {
  slug?: string;
};

async function getRequestedWorkspaceIdFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  for (const cookieName of KNOWN_WORKSPACE_COOKIE_NAMES) {
    const value = cookieStore.get(cookieName)?.value?.trim();
    if (value) return value;
  }
  return null;
}

function mapGlobalRole(input: { globalRole?: string | null; legacyRole?: string | null }): string {
  if (input.globalRole?.trim()) return input.globalRole.trim();
  if (input.legacyRole === "SUPER_ADMIN") return "SUPER_ADMIN";
  return "USER";
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(DNX_SESSION_COOKIE)?.value;
  if (!rawToken) return null;

  const sessionUser = await getSessionUserByRawToken(rawToken);
  if (!sessionUser) return null;

  const requestedWorkspaceId = await getRequestedWorkspaceIdFromCookies();
  const identity = await getSessionIdentityByRawToken(rawToken, {
    currentWorkspaceId: requestedWorkspaceId,
  });

  return {
    id: sessionUser.id,
    name: sessionUser.name,
    email: sessionUser.email,
    role: sessionUser.role,
    globalRole: mapGlobalRole({
      globalRole: identity?.globalRole,
      legacyRole: sessionUser.role,
    }),
    currentWorkspaceId: identity?.currentWorkspaceId ?? requestedWorkspaceId,
    workspaceRole: identity?.workspaceRole ?? null,
    appAccess: identity?.appAccess ?? [],
  };
}

export async function requireUser(options?: { redirectTo?: string }): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(options?.redirectTo ?? "/login");
    throw new Error("AUTH_GUARDS_UNREACHABLE_REQUIRE_USER");
  }
  return user;
}

export async function isSuperAdmin(user?: CurrentUser | null): Promise<boolean> {
  const effectiveUser = user ?? (await getCurrentUser());
  return effectiveUser?.globalRole === "SUPER_ADMIN";
}

export async function getWorkspaceBySlug(slug: string): Promise<WorkspaceSummary | null> {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!normalizedSlug) return null;

  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug: normalizedSlug },
    select: {
      workspace: {
        select: {
          id: true,
          name: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  return branding?.workspace ?? null;
}

export async function getCurrentWorkspace(options?: CurrentWorkspaceOptions): Promise<WorkspaceContext | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  let workspaceId = user.currentWorkspaceId;
  const requestedSlug = options?.slug?.trim();
  if (requestedSlug) {
    const workspaceFromSlug = await getWorkspaceBySlug(requestedSlug);
    workspaceId = workspaceFromSlug?.id ?? null;
  }
  if (!workspaceId) return null;

  const membership = await getUserWorkspaceMembership(user.id, workspaceId);
  if (!membership) return null;

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!workspace) return null;

  return {
    workspace,
    membership,
  };
}

export async function requireWorkspace(options?: { redirectTo?: string }): Promise<WorkspaceContext> {
  const context = await getCurrentWorkspace();
  if (!context) {
    redirect(options?.redirectTo ?? "/dashboard");
    throw new Error("AUTH_GUARDS_UNREACHABLE_REQUIRE_WORKSPACE");
  }
  return context;
}

export async function getUserWorkspaceMembership(
  userId: number,
  workspaceId: string,
): Promise<WorkspaceMembershipSummary | null> {
  return prisma.workspaceMembership.findUnique({
    where: {
      userId_workspaceId: {
        userId,
        workspaceId,
      },
    },
    select: {
      id: true,
      userId: true,
      workspaceId: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function requireWorkspaceMembership(options?: {
  redirectTo?: string;
}): Promise<WorkspaceContext> {
  const context = await getCurrentWorkspace();
  if (!context) {
    redirect(options?.redirectTo ?? "/dashboard");
    throw new Error("AUTH_GUARDS_UNREACHABLE_REQUIRE_WORKSPACE_MEMBERSHIP");
  }
  return context;
}

export async function requireWorkspaceRole(
  roles: WorkspaceRole[],
  options?: { redirectTo?: string },
): Promise<WorkspaceContext> {
  const context = await requireWorkspaceMembership(options);
  if (!roles.includes(context.membership.role)) {
    redirect(options?.redirectTo ?? "/dashboard?forbidden=workspace-role");
  }
  return context;
}

export async function requireWorkspaceModule(
  moduleKey: string,
  options?: { redirectTo?: string },
): Promise<WorkspaceContext> {
  const context = await requireWorkspaceMembership(options);
  const key = moduleKey.trim();
  if (!key) {
    redirect(options?.redirectTo ?? "/dashboard?module=off");
  }

  const moduleStatus = await prisma.workspaceFeatureModule.findUnique({
    where: {
      workspaceId_moduleKey: {
        workspaceId: context.workspace.id,
        moduleKey: key,
      },
    },
    select: {
      enabled: true,
    },
  });

  if (!moduleStatus?.enabled) {
    redirect(options?.redirectTo ?? "/dashboard?module=off");
  }

  return context;
}

export async function getUserWorkspaces(userId?: number): Promise<WorkspaceSummary[]> {
  const effectiveUserId = userId ?? (await requireUser()).id;
  const memberships = await prisma.workspaceMembership.findMany({
    where: { userId: effectiveUserId },
    select: {
      workspace: {
        select: {
          id: true,
          name: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  return memberships.map((membership: { workspace: WorkspaceSummary }) => membership.workspace);
}
