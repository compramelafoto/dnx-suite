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

export type RoleOption = {
  kind: "TEAM" | "MEMBER";
  /** "Socio" (palabra del vocabulario) o "Comisión" / "Administración" según el rol de equipo. */
  label: string;
  /** El activo sale de la pantalla en la que está la persona, no de un estado guardado. */
  active: boolean;
};

export type RoleSelector = { workspaceId: string; options: RoleOption[] };

/**
 * El selector de rol del menú lateral, como el de FotoRank.
 *
 * Sólo existe si la persona tiene los DOS perfiles (socio y equipo) en la institución que está
 * viendo; perfiles en otras instituciones no cuentan. El equipo se llama "Comisión" cuando su
 * rol es STAFF y "Administración" cuando es dueño o admin.
 *
 * Pura a propósito: los marcos sólo dibujan lo que esto decide.
 */
export function roleSelector(
  profiles: UserProfile[],
  current: { kind: "TEAM" | "MEMBER"; workspaceId: string | null },
  vocabulary: { Singular: string },
): RoleSelector | null {
  if (current.workspaceId === null) return null;
  const workspaceId = current.workspaceId;
  const member = profiles.find((p) => p.kind === "MEMBER" && p.workspaceId === workspaceId);
  const team = profiles.find((p) => p.kind === "TEAM" && p.workspaceId === workspaceId);
  if (!member || !team || team.kind !== "TEAM") return null;

  return {
    workspaceId,
    options: [
      { kind: "MEMBER", label: vocabulary.Singular, active: current.kind === "MEMBER" },
      { kind: "TEAM", label: teamRoleLabel(team.role), active: current.kind === "TEAM" },
    ],
  };
}

function teamRoleLabel(role: string): string {
  return PANEL_DAILY_ROLES.has(role) ? "Administración" : "Comisión";
}

export type InstitutionChoice = {
  workspaceId: string;
  workspaceName: string;
  /** Es SU negocio: la persona es dueña del workspace. */
  ownBusiness: boolean;
  /** Su número de socio ahí, si lo es. */
  memberNumber: string | null;
  profiles: UserProfile[];
};

/** Una opción por institución (no por perfil), para el selector de entrada. */
export function institutionChoices(profiles: UserProfile[]): InstitutionChoice[] {
  const byWorkspace = new Map<string, InstitutionChoice>();
  for (const p of profiles) {
    let choice = byWorkspace.get(p.workspaceId);
    if (!choice) {
      choice = {
        workspaceId: p.workspaceId,
        workspaceName: p.workspaceName,
        ownBusiness: false,
        memberNumber: null,
        profiles: [],
      };
      byWorkspace.set(p.workspaceId, choice);
    }
    choice.profiles.push(p);
    if (p.kind === "TEAM" && p.role === "WORKSPACE_OWNER") choice.ownBusiness = true;
    if (p.kind === "MEMBER") choice.memberNumber = p.memberNumber;
  }
  return [...byWorkspace.values()];
}

/**
 * Con qué perfil se entra al elegir una institución.
 *
 * Es `resolveEntryProfile` sobre los perfiles de ESA institución: el recordado manda si es de
 * ella; si no, dueño/admin → panel, comisión → portal. Institución ajena → `null`.
 */
export function entryProfileForInstitution(
  profiles: UserProfile[],
  workspaceId: string,
  rememberedKey: string | null,
): UserProfile | null {
  const own = profiles.filter((p) => p.workspaceId === workspaceId);
  const decision = resolveEntryProfile(own, rememberedKey);
  return decision.kind === "go" ? decision.profile : null;
}
