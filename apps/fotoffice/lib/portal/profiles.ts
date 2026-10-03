import { prisma } from "@repo/db";
import { PORTAL_HOME } from "./destination";

/**
 * Los perfiles con los que una misma persona puede entrar a FotoOffice.
 *
 * Una cuenta puede ser dos cosas a la vez y son independientes: administrar su propio negocio
 * (equipo de un workspace) y ser socio de una institución. El caso no es raro — un fotógrafo
 * socio de una sociedad que además usa FotoOffice para su estudio es el caso esperado.
 *
 * Esto SOLO describe a dónde puede ir la persona. No otorga ni recorta permisos: cada ruta
 * sigue autorizando por su cuenta, el panel por membresía y el portal por ficha de socio.
 */

export type UserProfile =
  | {
      kind: "TEAM";
      workspaceId: string;
      workspaceName: string;
      role: string;
    }
  | {
      kind: "MEMBER";
      workspaceId: string;
      workspaceName: string;
      memberId: string;
      memberNumber: string;
    };

export async function listUserProfiles(userId: number): Promise<UserProfile[]> {
  const [teams, memberships] = await Promise.all([
    prisma.workspaceMembership.findMany({
      where: { userId },
      select: { role: true, workspace: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.member.findMany({
      where: { userId, status: "ACTIVE" },
      select: { id: true, memberNumber: true, workspace: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return [
    ...teams.map((t): UserProfile => ({
      kind: "TEAM",
      workspaceId: t.workspace.id,
      workspaceName: t.workspace.name,
      role: t.role,
    })),
    ...memberships.map((m): UserProfile => ({
      kind: "MEMBER",
      workspaceId: m.workspace.id,
      workspaceName: m.workspace.name,
      memberId: m.id,
      memberNumber: m.memberNumber,
    })),
  ];
}

/**
 * Identificador estable de un perfil, para guardarlo en la cookie.
 *
 * Combina tipo y workspace porque una misma persona puede ser equipo de un workspace Y socio
 * de otro: el workspace solo no alcanza para distinguirlos.
 */
export function profileKey(profile: UserProfile): string {
  return `${profile.kind}:${profile.workspaceId}`;
}

/** Busca un perfil por su clave. Devuelve `null` si la persona ya no lo tiene. */
export function findProfileByKey(profiles: UserProfile[], key: string | null): UserProfile | null {
  if (!key) return null;
  return profiles.find((p) => profileKey(p) === key) ?? null;
}

export function profileDestination(profile: UserProfile): string {
  return profile.kind === "TEAM" ? "/workspace" : PORTAL_HOME;
}

export type EntryDecision =
  | { kind: "none" }
  | { kind: "ask" }
  | { kind: "go"; profile: UserProfile };

/** ¿Los perfiles de la persona están repartidos en más de una institución? */
export function hasProfilesInSeveralWorkspaces(profiles: UserProfile[]): boolean {
  return new Set(profiles.map((p) => p.workspaceId)).size > 1;
}

/**
 * Con qué perfil entra la persona al iniciar sesión.
 *
 * - Sin perfiles: `none` (sigue el camino de quien no se reconoce).
 * - Todos en UNA institución: no hay nada que elegir entre instituciones. Entra con el perfil
 *   recordado si sigue siendo suyo; si no, al panel si es dueño o admin (lo usa a diario); si
 *   no, como socio; si no, como equipo (p. ej. STAFF sin ficha de socio).
 *   Cambiar entre portal y panel es un botón, no una pregunta.
 * - En más de una institución: entra con el recordado si sigue siendo suyo; si no, se pregunta.
 *
 * El recordado viene de una cookie y no se cree: tiene que aparecer en la lista real.
 */
export function resolveEntryProfile(
  profiles: UserProfile[],
  rememberedKey: string | null,
): EntryDecision {
  if (profiles.length === 0) return { kind: "none" };

  const remembered = findProfileByKey(profiles, rememberedKey);
  if (remembered) return { kind: "go", profile: remembered };

  if (hasProfilesInSeveralWorkspaces(profiles)) return { kind: "ask" };

  const runsThePanel = profiles.find(
    (p) => p.kind === "TEAM" && PANEL_DAILY_ROLES.has(p.role),
  );
  if (runsThePanel) return { kind: "go", profile: runsThePanel };

  const member = profiles.find((p) => p.kind === "MEMBER");
  if (member) return { kind: "go", profile: member };

  // Quedan sólo perfiles de equipo sin rol de administración (STAFF) — y hay al menos uno.
  return { kind: "go", profile: profiles[0] };
}

/** Roles que administran la institución a diario: con ellos el panel es la entrada natural. */
const PANEL_DAILY_ROLES = new Set(["WORKSPACE_OWNER", "WORKSPACE_ADMIN"]);

/** El perfil del otro tipo (equipo ⇄ socio) en la MISMA institución, si la persona lo tiene. */
export function counterpartProfile(
  profiles: UserProfile[],
  current: { kind: "TEAM" | "MEMBER"; workspaceId: string },
): UserProfile | null {
  const otherKind = current.kind === "TEAM" ? "MEMBER" : "TEAM";
  return (
    profiles.find((p) => p.kind === otherKind && p.workspaceId === current.workspaceId) ?? null
  );
}

export type HeaderSwitches = {
  /** El perfil del otro lado (panel ⇄ portal) en la misma institución: su botón directo. */
  counterpart: UserProfile | null;
  /** El botón general "Cambiar de perfil": sólo tiene sentido con más de una institución. */
  showGeneralSwitch: boolean;
};

/**
 * Qué botones de cambio muestra el encabezado de quien está en `current`.
 *
 * Pura a propósito: los encabezados sólo dibujan lo que esto decide, y la decisión se prueba
 * sin montar componentes. Con todos los perfiles en una institución, ir y volver entre portal
 * y panel es un botón directo; el selector general queda para quien tiene más de una.
 */
export function headerSwitches(
  profiles: UserProfile[],
  current: { kind: "TEAM" | "MEMBER"; workspaceId: string | null },
): HeaderSwitches {
  return {
    counterpart:
      current.workspaceId === null
        ? null
        : counterpartProfile(profiles, { kind: current.kind, workspaceId: current.workspaceId }),
    showGeneralSwitch: hasProfilesInSeveralWorkspaces(profiles),
  };
}
