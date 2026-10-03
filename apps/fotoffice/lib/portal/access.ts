import { prisma } from "@repo/db";
import { readProfileChoice } from "./profile-choice";

/**
 * Autorización del portal del socio.
 *
 * Cuatro condiciones y ninguna más: sesión autenticada, ficha de socio cuyo `userId` es el de
 * esa sesión, el workspace al que pertenece esa ficha, y estado permitido.
 *
 * Deliberadamente NO interviene `WorkspaceMembership`. Los roles OWNER/ADMIN/STAFF describen
 * al equipo que administra la institución; un socio no es parte de ese equipo y agregarlo
 * como STAFF para "que entre" le daría permisos administrativos que no le corresponden.
 *
 * Nada se toma del navegador: el `userId` sale de la sesión y el workspace sale de la ficha.
 */

export type PortalContext = {
  member: {
    id: string;
    firstName: string;
    lastName: string;
    memberNumber: string;
    /** Desde cuándo pertenece. Migrado de otro sistema: puede venir con fechas raras. */
    joinedAt: Date;
    /** Nombre de la categoría, o `null` si la ficha no tiene una asignada. */
    categoryName: string | null;
  };
  workspace: { id: string; name: string };
};

const MEMBER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  memberNumber: true,
  joinedAt: true,
  category: { select: { name: true } },
  workspace: { select: { id: true, name: true } },
} as const;

/**
 * La institución de socio que la persona eligió (cookie `MEMBER:<ws>`), o `null`.
 *
 * Es sólo una preferencia: se usa como filtro ADEMÁS de `userId` y `ACTIVE`, así que una
 * cookie manipulada no abre nada ajeno. Fuera de una petición no hay cookies: `null`.
 */
async function rememberedMemberWorkspace(): Promise<string | null> {
  let key: string | null;
  try {
    key = await readProfileChoice();
  } catch {
    return null;
  }
  if (!key?.startsWith("MEMBER:")) return null;
  return key.slice("MEMBER:".length) || null;
}

export async function loadPortalContext(userId: number): Promise<PortalContext | null> {
  // Socio de varias instituciones: abre la elegida si sigue siendo una ficha ACTIVE suya.
  const workspaceId = await rememberedMemberWorkspace();
  const chosen = workspaceId
    ? await prisma.member.findFirst({
        where: { userId, status: "ACTIVE", workspaceId },
        select: MEMBER_SELECT,
      })
    : null;
  const member =
    chosen ??
    (await prisma.member.findFirst({
      where: { userId, status: "ACTIVE" },
      select: MEMBER_SELECT,
      // Determinista sin elección: la ficha más antigua.
      orderBy: { createdAt: "asc" },
    }));
  if (!member) return null;

  return {
    member: {
      id: member.id,
      firstName: member.firstName,
      lastName: member.lastName,
      memberNumber: member.memberNumber,
      joinedAt: member.joinedAt,
      categoryName: member.category?.name ?? null,
    },
    workspace: member.workspace,
  };
}
