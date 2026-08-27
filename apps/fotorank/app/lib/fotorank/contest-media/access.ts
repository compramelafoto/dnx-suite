/**
 * Quién puede tocar las imágenes de un concurso.
 *
 * El punto delicado: `getFotorankContestById` no filtra por organización, así
 * que tener sesión de dashboard y un id ajeno alcanzaría para operar sobre un
 * concurso de otra organización. Toda escritura sobre imágenes pasa por acá, y
 * acá se resuelve la organización DESDE el concurso — nunca desde un parámetro
 * que mande el cliente.
 */

import { prisma } from "@repo/db";
import type { AuthUser } from "../../auth";
import { userIsFotorankSuperAdmin } from "../access/super-admin";

/** Roles que pueden cambiar la cara pública de un concurso. */
const ROLES_THAT_MANAGE_MEDIA = ["OWNER", "ADMIN", "EDITOR"] as const;

/** Roles que pueden mirar el material aún no publicado, sin poder cambiarlo. */
const ROLES_THAT_PREVIEW_MEDIA = [...ROLES_THAT_MANAGE_MEDIA, "VIEWER"] as const;

export type ContestMediaAccess = {
  contestId: string;
  organizationId: string;
  contestSlug: string;
  contestTitle: string;
  contestStatus: string;
  canManage: boolean;
  canPreview: boolean;
  /** Por qué se denegó, para el mensaje y para el registro. */
  deniedReason: "not_found" | "not_a_member" | "insufficient_role" | null;
};

/**
 * Resuelve el acceso de una persona a las imágenes de un concurso.
 *
 * Devuelve `null` sólo si el concurso no existe. Para todo lo demás devuelve el
 * detalle, de modo que quien llama pueda distinguir "no existe" de "existe pero
 * no es tuyo" y responder con el código correcto sin filtrar información.
 */
export async function resolveContestMediaAccess(
  user: AuthUser | null,
  contestId: string,
): Promise<ContestMediaAccess | null> {
  if (!user) return null;

  const contest = await prisma.fotorankContest.findUnique({
    where: { id: contestId },
    select: {
      id: true,
      organizationId: true,
      slug: true,
      title: true,
      status: true,
    },
  });
  if (!contest) return null;

  const base = {
    contestId: contest.id,
    organizationId: contest.organizationId,
    contestSlug: contest.slug,
    contestTitle: contest.title,
    contestStatus: String(contest.status),
  };

  /**
   * El super admin de plataforma pasa siempre. Es quien atiende los pedidos de
   * soporte de las organizaciones, y sus acciones quedan igual en el historial
   * de la imagen porque se registra el usuario que subió.
   */
  if (userIsFotorankSuperAdmin(user)) {
    return { ...base, canManage: true, canPreview: true, deniedReason: null };
  }

  const membership = await prisma.contestOrganizationMember.findFirst({
    where: {
      organizationId: contest.organizationId,
      userId: user.id,
      status: "ACTIVE",
    },
    select: { role: true },
  });

  if (!membership) {
    return { ...base, canManage: false, canPreview: false, deniedReason: "not_a_member" };
  }

  const role = String(membership.role);
  const canManage = (ROLES_THAT_MANAGE_MEDIA as readonly string[]).includes(role);
  const canPreview = (ROLES_THAT_PREVIEW_MEDIA as readonly string[]).includes(role);

  return {
    ...base,
    canManage,
    canPreview,
    deniedReason: canManage ? null : "insufficient_role",
  };
}

export type ContestMediaAuthzFailure = {
  status: 401 | 403 | 404;
  message: string;
};

/**
 * Traduce el acceso a una respuesta HTTP.
 *
 * A quien no es miembro se le responde 404, no 403: confirmarle que el concurso
 * existe ya es información sobre una organización ajena. Al miembro sin rol
 * suficiente sí se le dice 403, porque él ya sabe que el concurso existe.
 */
export function authorizeContestMediaWrite(
  access: ContestMediaAccess | null,
  user: AuthUser | null,
): ContestMediaAuthzFailure | null {
  if (!user) return { status: 401, message: "Iniciá sesión para administrar el concurso." };
  if (!access) return { status: 404, message: "No encontramos ese concurso." };
  if (access.deniedReason === "not_a_member") {
    return { status: 404, message: "No encontramos ese concurso." };
  }
  if (!access.canManage) {
    return {
      status: 403,
      message: "Tu rol en la organización no permite cambiar las imágenes del concurso.",
    };
  }
  return null;
}
