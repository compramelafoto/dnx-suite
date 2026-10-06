import { prisma } from "@repo/db";
import { syncPendingTeamMemberships } from "@/lib/commission/team-membership";
import { findFotofficeWorkspaceForUser } from "@/lib/ensure-workspace";
import { WELCOME_PATH } from "@/lib/entrada/welcome";
import { doorReturnPath } from "@/lib/entrada/institution-door";
import { sharedReturnPath } from "@/lib/governance/share";
import { findClaimableMembership } from "@/lib/portal/claim";
import { isFotofficePlatformAdminRole, resolvePlatformRole } from "@/lib/fotoffice-roles";
import { safeFotofficeNextPath } from "@/lib/google-login";
import { resolveInvitationContinuityPath } from "@/lib/members/invitation-continuity-resolve";
import { resolvePortalDestination } from "@/lib/portal/destination";
import { readProfileChoice } from "@/lib/portal/profile-choice";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";
import { listUserProfiles, resolveEntryProfile } from "@/lib/portal/profiles";
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

  // Un socio que recibió cargo o rol antes de tener cuenta entra al panel desde su primer
  // inicio de sesión con la cuenta vinculada (diseño de Roles §12.1.4). Si falla, no bloquea el login.
  try {
    await syncPendingTeamMemberships(user.id);
  } catch (error) {
    console.error("[post-login] No se pudo sincronizar la membresía de equipo", error);
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

  /*
    Quien entró por la puerta de una institución —`/w/sfpr/entrar`— ya dijo a dónde viene, y
    eso vale más que cualquier cosa que pueda decidirse acá: más que el selector de perfil
    (preguntarle sería ignorar lo que ya contestó) y más que el portal genérico.

    Se lo devuelve a la puerta en vez de resolverlo acá porque la puerta es la única que sabe
    a qué workspace corresponde ese slug. `parseDoorPath` es estricto: cualquier `next` que no
    sea exactamente esa forma sigue el camino de siempre.
  */
  const door = doorReturnPath(params.next);
  if (door) return { path: door, workspaceId: null };

  // Lo mismo con el enlace de un proyecto o una reunión que llegó por WhatsApp: la ruta del
  // enlace sabe a dónde va cada uno (comisión o socio), así que se vuelve a ella.
  const shared = sharedReturnPath(params.next);
  if (shared) return { path: shared, workspaceId: null };

  /**
   * Con qué perfil entra. Sólo se pregunta cuando los perfiles están repartidos en más de una
   * institución: equipo y socio de la MISMA institución entra directo (al panel si es dueño o
   * admin; si no, al portal) y cambia con el botón del encabezado. Una elección recordada y válida se respeta siempre.
   */
  const profiles = await listUserProfiles(user.id);
  const entry = resolveEntryProfile(profiles, await readProfileChoice());
  if (entry.kind === "ask") return { path: "/elegir-perfil", workspaceId: null };
  if (entry.kind === "go" && entry.profile.kind === "MEMBER") {
    return { path: resolvePortalDestination(params.next), workspaceId: null };
  }
  // Perfil de equipo: sigue por el camino normal, pero con SU institución como activa.
  const chosenTeamWorkspaceId =
    entry.kind === "go" && entry.profile.kind === "TEAM" ? entry.profile.workspaceId : null;

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

  // Alguien que compró un curso y no es socio ni equipo: su lugar es Mis cursos. Va después
  // de `/soy-socio` a propósito: si además es un socio sin vincular, eso se resuelve primero.
  if (kind === "STUDENT") return { path: "/portal/cursos", workspaceId: null };

  /*
    Hasta acá no se reconoció a nadie: ni equipo, ni socio, ni invitación pendiente. Antes el
    paso siguiente le creaba una institución con esta persona de dueña, y así aparecieron las
    dos fantasma de producción. Ahora se le pregunta a qué vino.

    El `next` del navegador tampoco puede saltear la pregunta: un `/workspace` guardado en
    favoritos volvería a abrir el mismo camino.
  */
  const ensured = await findFotofficeWorkspaceForUser({
    userId: user.id,
    email: user.email,
    name: user.name,
  });
  if (!ensured) return { path: WELCOME_PATH, workspaceId: null };

  /*
    `find` prefiere la institución de la que la persona es dueña. Si eligió entrar al panel de
    OTRA (por ejemplo, la sociedad donde es de la Comisión), esa es la activa: el onboarding
    pendiente de su estudio propio no la desvía de ahí.
  */
  const workspaceId = chosenTeamWorkspaceId ?? ensured.workspaceId;

  /*
    El onboarding lo completa el dueño o un admin (`app/onboarding` lo exige). Un STAFF de una
    institución con el onboarding pendiente entra al panel. Sin perfil de equipo en la lista
    es el caso legacy que `find` acaba de promover a dueño: ése sí va al onboarding.
  */
  const teamProfile = profiles.find((p) => p.kind === "TEAM" && p.workspaceId === workspaceId);
  const canOnboard = teamProfile?.kind === "TEAM" ? canManageWorkspaceSettings(teamProfile.role) : true;
  if (workspaceId === ensured.workspaceId && !ensured.onboardingCompleted && canOnboard) {
    return { path: "/onboarding", workspaceId };
  }

  const next = safeFotofficeNextPath(params.next);
  if (next && !next.startsWith("/login") && !next.startsWith("/api")) {
    return { path: next, workspaceId };
  }

  return { path: "/workspace", workspaceId };
}
