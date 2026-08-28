import { prisma } from "@repo/db";
import { ensureFotofficeWorkspaceForUser } from "@/lib/ensure-workspace";
import { findClaimableMembership } from "@/lib/portal/claim";
import { isFotofficePlatformAdminRole, resolvePlatformRole } from "@/lib/fotoffice-roles";
import { safeFotofficeNextPath } from "@/lib/google-login";
import { resolveInvitationContinuityPath } from "@/lib/members/invitation-continuity-resolve";
import { resolvePortalDestination } from "@/lib/portal/destination";
import { readProfileChoice } from "@/lib/portal/profile-choice";
import { findProfileByKey, listUserProfiles, needsProfileChoice } from "@/lib/portal/profiles";
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

  /**
   * Con más de un perfil hay que preguntar: la misma persona puede administrar su negocio y
   * ser socia de una institución, y solo ella sabe a cuál de las dos viene hoy. Si ya eligió
   * antes, se respeta esa elección y no se vuelve a preguntar.
   */
  const profiles = await listUserProfiles(user.id);
  if (needsProfileChoice(profiles)) {
    const chosen = findProfileByKey(profiles, await readProfileChoice());
    // Sin elección previa —o con una que ya no corresponde— se pregunta de nuevo.
    if (!chosen) return { path: "/elegir-perfil", workspaceId: null };
    if (chosen.kind === "MEMBER") {
      return { path: resolvePortalDestination(params.next), workspaceId: null };
    }
    // Perfil de equipo: sigue por el camino normal, que prepara su workspace.
  }

  // Un socio no tiene panel administrativo ni workspace propio: nunca se llama a `ensure`.
  if (kind === "MEMBER") {
    return { path: resolvePortalDestination(params.next), workspaceId: null };
  }

  /*
   * Antes de crearle un negocio a nadie, mirar si no es un socio todavía sin vincular.
   *
   * `kind` responde por el vínculo `Member.userId`, que solo existe después de aceptar la
   * invitación. En la ventana entre que la Secretaría aprueba y el socio acepta, la misma
   * persona figura como "usuaria nueva" — y le creábamos un workspace propio con ella de
   * dueña. Le pasó a una socia real: entró a ver su cuota y se encontró administrando un
   * negocio que nunca pidió, sin su pago a la vista.
   *
   * Coincidir el email habilita a preguntar, no a vincular: la pantalla pide confirmación.
   */
  if (await findClaimableMembership({ userId: user.id, email: user.email })) {
    return { path: "/soy-socio", workspaceId: null };
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
