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

/** Solo hay que preguntar cuando hay más de una forma real de entrar. */
export function needsProfileChoice(profiles: UserProfile[]): boolean {
  return profiles.length > 1;
}
