"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { removeMember, revokeTeamInvitation, TeamError } from "@repo/db/fotoffice-team";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { puede } from "@/lib/access/policy";
import { checkRateLimit } from "@/lib/geocode/rate-limit";
import { inviteTeamMember } from "@/lib/team/invite";
import { rolesOfrecidos, validarAccionSobreMiembro } from "@/lib/team/rules";
import { MOTIVO_COMISION, motivoSinBaja } from "@/lib/team/vista";

/**
 * Equipo del espacio de trabajo: invitar, reenviar, anular y dar de baja.
 *
 * El workspace y el rol del actor salen SIEMPRE de la sesión (el workspace activo, el mismo del
 * menú), nunca de un campo del formulario. Cada acción vuelve a chequear el permiso aunque la
 * pantalla ya lo haya hecho: una server action se puede llamar sin pasar por la pantalla.
 * La bitácora (`WorkspaceAdminEvent`: INVITED, INVITE_REVOKED, REMOVED) la escribe
 * `@repo/db/fotoffice-team` en la misma transacción de cada cambio.
 */

export type EquipoState = {
  error: string | null;
  ok?: string;
  warn?: string;
  /** Enlace de invitación con el token en claro: existe sólo en esta respuesta. */
  enlace?: string;
};

const RUTA = "/workspace/configuracion/equipo";
const SIN_PERMISO = "No tenés permiso para gestionar el equipo.";

/**
 * Colaborador queda afuera: sin roles de la comisión no ve ningún módulo, y la comisión sólo
 * asigna roles a socios. Ofrecerlo a un estudio sería invitar a alguien a una pantalla vacía.
 */
const COLABORADOR_DISPONIBLE = false;

/** Freno contra un bucle o un doble clic insistente: 20 invitaciones por hora por persona y espacio. */
const TOPE_INVITACIONES = 20;
const UNA_HORA = 60 * 60 * 1000;

async function contexto() {
  const { user, workspace, role } = await requireActiveWorkspaceRole();
  return { user, workspaceId: workspace.id, role, autorizado: Boolean(role && puede(role, "gestionarEquipo")) };
}

function pasaElFreno(userId: number, workspaceId: string): boolean {
  return checkRateLimit({ key: `equipo-invitar:${workspaceId}:${userId}`, limit: TOPE_INVITACIONES, windowMs: UNA_HORA })
    .allowed;
}

const FRENADO = "Mandaste muchas invitaciones seguidas. Esperá un rato y probá de nuevo.";

export async function inviteTeamAction(_prev: EquipoState | undefined, fd: FormData): Promise<EquipoState> {
  const { user, workspaceId, role, autorizado } = await contexto();
  if (!autorizado || !role) return { error: SIN_PERMISO };
  const nuevoRol = String(fd.get("role") ?? "");
  if (!rolesOfrecidos(role, COLABORADOR_DISPONIBLE).includes(nuevoRol)) {
    return { error: "Ese rol no está disponible." };
  }
  if (!pasaElFreno(user.id, workspaceId)) return { error: FRENADO };
  const r = await inviteTeamMember({
    workspaceId,
    actor: { id: user.id, name: user.name },
    email: String(fd.get("email") ?? ""),
    role: nuevoRol,
  });
  if (!r.ok) return { error: r.error };
  revalidatePath(RUTA);
  return { error: null, ok: `Invitación enviada a ${r.sentTo}.`, warn: r.warn, enlace: r.url };
}

export async function resendInvitationAction(_prev: EquipoState | undefined, fd: FormData): Promise<EquipoState> {
  const { user, workspaceId, role, autorizado } = await contexto();
  if (!autorizado || !role) return { error: SIN_PERMISO };
  const inv = await prisma.workspaceInvitation.findFirst({
    where: { id: String(fd.get("invitationId") ?? ""), workspaceId, acceptedAt: null, revokedAt: null },
    select: { email: true, role: true },
  });
  if (!inv) return { error: "No se encontró la invitación o ya no está pendiente." };
  if (!rolesOfrecidos(role, COLABORADOR_DISPONIBLE).includes(inv.role)) {
    return { error: "Ese rol no está disponible." };
  }
  if (!pasaElFreno(user.id, workspaceId)) return { error: FRENADO };
  // Al crear la nueva, `createTeamInvitation` anula la anterior: el enlace viejo deja de servir.
  const r = await inviteTeamMember({
    workspaceId,
    actor: { id: user.id, name: user.name },
    email: inv.email,
    role: inv.role,
  });
  if (!r.ok) return { error: r.error };
  revalidatePath(RUTA);
  return { error: null, ok: `Invitación reenviada a ${r.sentTo}.`, warn: r.warn, enlace: r.url };
}

export async function revokeInvitationAction(_prev: EquipoState | undefined, fd: FormData): Promise<EquipoState> {
  const { user, workspaceId, autorizado } = await contexto();
  if (!autorizado) return { error: SIN_PERMISO };
  try {
    await revokeTeamInvitation(workspaceId, String(fd.get("invitationId") ?? ""), user.id);
  } catch (e) {
    if (e instanceof TeamError) return { error: "No se encontró la invitación o ya fue aceptada." };
    throw e;
  }
  revalidatePath(RUTA);
  return { error: null, ok: "Invitación cancelada: el enlace ya no sirve." };
}

export async function removeMemberAction(_prev: EquipoState | undefined, fd: FormData): Promise<EquipoState> {
  const { user, workspaceId, role, autorizado } = await contexto();
  if (!autorizado || !role) return { error: SIN_PERMISO };
  const targetUserId = Number(fd.get("userId"));
  if (!Number.isInteger(targetUserId) || targetUserId <= 0) return { error: "No se encontró a esa persona en el equipo." };
  const [objetivo, rolesComision, duenosRestantes] = await Promise.all([
    prisma.workspaceMembership.findUnique({
      where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
      select: { role: true },
    }),
    prisma.workspaceRoleAssignment.count({
      where: { workspaceId, OR: [{ userId: targetUserId }, { member: { userId: targetUserId, workspaceId } }] },
    }),
    prisma.workspaceMembership.count({ where: { workspaceId, role: "WORKSPACE_OWNER" } }),
  ]);
  if (!objetivo) return { error: "No se encontró a esa persona en el equipo." };
  const motivo = motivoSinBaja({
    role: objetivo.role,
    esUnoMismo: targetUserId === user.id,
    tieneRolesComision: rolesComision > 0,
  });
  if (motivo === MOTIVO_COMISION) return { error: MOTIVO_COMISION };
  if (motivo !== "") return { error: "Desde acá sólo se puede dar de baja a alguien con rol Equipo." };
  const error = validarAccionSobreMiembro({
    actorRole: role,
    objetivoRole: objetivo.role,
    esUnoMismo: false,
    duenosRestantes,
    accion: { tipo: "DAR_DE_BAJA" },
  });
  if (error) return { error };
  try {
    await removeMember(workspaceId, targetUserId, user.id);
  } catch (e) {
    if (e instanceof TeamError) return { error: "No se encontró a esa persona en el equipo." };
    throw e;
  }
  revalidatePath(RUTA);
  return { error: null, ok: "Listo: ya no tiene acceso a este espacio." };
}
