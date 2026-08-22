import { prisma } from "@repo/db";
import { ensureFotofficeWorkspaceForUser } from "@/lib/ensure-workspace";
import { isFotofficePlatformAdminRole, resolvePlatformRole } from "@/lib/fotoffice-roles";
import { safeFotofficeNextPath } from "@/lib/google-login";
import { resolveInvitationContinuityPath } from "@/lib/members/invitation-continuity-resolve";
import { resolvePortalDestination } from "@/lib/portal/destination";
import { resolveFotofficeUserKind } from "@/lib/portal/user-kind";

/** Ruta de aceptación de invitación, validada como interna. `/invitacionfalsa` no cuenta. */
function safeInvitationPath(next: string | null | undefined): string | null {
  const path = safeFotofficeNextPath(next);
  if (!path) return null;
  return path === "/invitacion" || path.startsWith("/invitacion/") ? path : null;
}

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

  const kind = await resolveFotofficeUserKind(user.id);

  // Quien vuelve a completar una invitación va ahí, sea quien sea. Se resuelve ANTES de
  // `ensure` a propósito: alguien que acaba de crear su contraseña todavía no figura como
  // socio, y tratarlo como fotógrafo nuevo le fabricaría un workspace en el peor momento.
  const invitationPath = safeInvitationPath(params.next);
  if (invitationPath) return { path: invitationPath, workspaceId: null };

  // Continuidad de una invitación a medio completar: se revisa SOLO acá, ya autenticado, y se
  // revalida contra la base. No consume la invitación — devuelve a la pantalla donde se acepta.
  const continuity = await resolveInvitationContinuityPath(user.email);
  if (continuity) return { path: continuity, workspaceId: null };

  // Un socio no tiene panel administrativo ni workspace propio: nunca se llama a `ensure`.
  if (kind === "MEMBER") {
    return { path: resolvePortalDestination(params.next), workspaceId: null };
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
