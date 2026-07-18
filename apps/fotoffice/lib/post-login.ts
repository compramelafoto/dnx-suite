import { prisma } from "@repo/db";
import { ensureFotofficeWorkspaceForUser } from "@/lib/ensure-workspace";
import { isFotofficePlatformAdminRole, resolvePlatformRole } from "@/lib/fotoffice-roles";
import { safeFotofficeNextPath } from "@/lib/google-login";

export type PostLoginDestination = {
  path: string;
  workspaceId: string | null;
};

/**
 * Destino post-login Fotoffice:
 * - SUPER_ADMIN → /admin
 * - Sin onboarding completo → /onboarding
 * - Con workspace → /workspace (o `next` seguro)
 */
export async function resolveFotofficePostLoginDestination(params: {
  userId: number;
  next?: string | null;
}): Promise<PostLoginDestination> {
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { id: true, email: true, name: true, role: true, globalRole: true },
  });
  if (!user) {
    return { path: "/login", workspaceId: null };
  }

  const platformRole = resolvePlatformRole({
    globalRole: user.globalRole,
    legacyRole: user.role,
  });
  if (isFotofficePlatformAdminRole(platformRole)) {
    const next = safeFotofficeNextPath(params.next);
    return { path: next?.startsWith("/admin") ? next : "/admin", workspaceId: null };
  }

  const ensured = await ensureFotofficeWorkspaceForUser({
    userId: user.id,
    email: user.email,
    name: user.name,
  });

  if (!ensured.onboardingCompleted) {
    return { path: "/onboarding", workspaceId: ensured.workspaceId };
  }

  const next = safeFotofficeNextPath(params.next);
  if (next && !next.startsWith("/login") && !next.startsWith("/api")) {
    return { path: next, workspaceId: ensured.workspaceId };
  }

  return { path: "/workspace", workspaceId: ensured.workspaceId };
}
