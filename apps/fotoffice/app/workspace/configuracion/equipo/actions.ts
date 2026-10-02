"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { changeMemberRole, removeMember, revokeTeamInvitation, TeamError } from "@repo/db/fotoffice-team";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { puede } from "@/lib/access/policy";
import { getModuleDefinition } from "@/lib/modules/registry";
import { inviteTeamMember } from "@/lib/team/invite";
import { rolesOfrecidos, validarAccionSobreMiembro, type Accion } from "@/lib/team/rules";

export type EquipoState = { error: string | null; ok?: string; warn?: string };

const RUTA = "/workspace/configuracion/equipo";
const SIN_PERMISO = "No tenés permiso para gestionar el equipo.";

/**
 * El workspace y el rol salen siempre de la sesión: nunca de un campo del formulario.
 * Es el workspace activo, el mismo que muestra el menú.
 */
async function contexto() {
  const { user, workspace, role } = await requireActiveWorkspaceRole();
  return { user, workspaceId: workspace.id, role };
}

const colaboradorDisponible = () => getModuleDefinition("projects")?.status === "AVAILABLE";

export async function inviteTeamAction(
  _prev: EquipoState | undefined,
  fd: FormData,
): Promise<EquipoState> {
  const { user, workspaceId, role } = await contexto();
  if (!role || !puede(role, "gestionarEquipo")) return { error: SIN_PERMISO };
  const nuevoRol = String(fd.get("role") ?? "");
  if (!rolesOfrecidos(role, colaboradorDisponible()).includes(nuevoRol)) {
    return { error: "Ese rol no está disponible." };
  }
  const r = await inviteTeamMember({
    workspaceId,
    actor: { id: user.id, name: user.name },
    email: String(fd.get("email") ?? ""),
    role: nuevoRol,
  });
  if (!r.ok) return { error: r.error };
  revalidatePath(RUTA);
  return { error: null, ok: `Invitación enviada a ${r.sentTo}.`, warn: r.warn };
}

async function sobreMiembro(
  fd: FormData,
  armar: (role: string) => Accion | EquipoState,
): Promise<EquipoState> {
  const { user, workspaceId, role } = await contexto();
  if (!role || !puede(role, "gestionarEquipo")) return { error: SIN_PERMISO };
  const armada = armar(role);
  if ("error" in armada) return armada;
  const accion = armada;
  const targetUserId = Number(fd.get("userId"));
  const objetivo = Number.isInteger(targetUserId)
    ? await prisma.workspaceMembership.findUnique({
        where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
        select: { role: true },
      })
    : null;
  if (!objetivo) return { error: "No se encontró a esa persona en el equipo." };
  const duenosRestantes = await prisma.workspaceMembership.count({
    where: { workspaceId, role: "WORKSPACE_OWNER" },
  });
  const error = validarAccionSobreMiembro({
    actorRole: role,
    objetivoRole: objetivo.role,
    esUnoMismo: targetUserId === user.id,
    duenosRestantes,
    accion,
  });
  if (error) return { error };
  try {
    if (accion.tipo === "DAR_DE_BAJA") await removeMember(workspaceId, targetUserId, user.id);
    else await changeMemberRole(workspaceId, targetUserId, accion.nuevoRol as never, user.id);
  } catch (e) {
    if (e instanceof TeamError) return { error: "No se encontró a esa persona en el equipo." };
    throw e;
  }
  revalidatePath(RUTA);
  return {
    error: null,
    ok: accion.tipo === "DAR_DE_BAJA" ? "Listo, ya no tiene acceso." : "Rol actualizado.",
  };
}

export async function changeRoleAction(
  _prev: EquipoState | undefined,
  fd: FormData,
): Promise<EquipoState> {
  const nuevoRol = String(fd.get("role") ?? "");
  return sobreMiembro(fd, (role) => {
    // "Dueño" no está en los roles que se ofrecen al invitar, pero un dueño puede nombrar a otro:
    // `validarAccionSobreMiembro` es quien le cierra esa puerta a un administrador.
    const permitidos = [...rolesOfrecidos(role, colaboradorDisponible()), "WORKSPACE_OWNER"];
    if (!permitidos.includes(nuevoRol)) return { error: "Ese rol no está disponible." };
    return { tipo: "CAMBIAR_ROL", nuevoRol };
  });
}

export async function removeMemberAction(
  _prev: EquipoState | undefined,
  fd: FormData,
): Promise<EquipoState> {
  return sobreMiembro(fd, () => ({ tipo: "DAR_DE_BAJA" }));
}

export async function revokeInvitationAction(
  _prev: EquipoState | undefined,
  fd: FormData,
): Promise<EquipoState> {
  const { user, workspaceId, role } = await contexto();
  if (!role || !puede(role, "gestionarEquipo")) return { error: SIN_PERMISO };
  try {
    await revokeTeamInvitation(workspaceId, String(fd.get("invitationId") ?? ""), user.id);
  } catch (e) {
    if (e instanceof TeamError) return { error: "No se encontró la invitación o ya fue aceptada." };
    throw e;
  }
  revalidatePath(RUTA);
  return { error: null, ok: "Invitación anulada." };
}

export async function resendInvitationAction(
  _prev: EquipoState | undefined,
  fd: FormData,
): Promise<EquipoState> {
  const { user, workspaceId, role } = await contexto();
  if (!role || !puede(role, "gestionarEquipo")) return { error: SIN_PERMISO };
  const inv = await prisma.workspaceInvitation.findFirst({
    where: { id: String(fd.get("invitationId") ?? ""), workspaceId, acceptedAt: null },
    select: { email: true, role: true },
  });
  if (!inv) return { error: "No se encontró la invitación." };
  if (!rolesOfrecidos(role, colaboradorDisponible()).includes(inv.role)) {
    return { error: "Ese rol no está disponible." };
  }
  // Al crear la nueva, `createTeamInvitation` deja sin efecto la anterior.
  const r = await inviteTeamMember({
    workspaceId,
    actor: { id: user.id, name: user.name },
    email: inv.email,
    role: inv.role,
  });
  if (!r.ok) return { error: r.error };
  revalidatePath(RUTA);
  return { error: null, ok: `Invitación reenviada a ${r.sentTo}.`, warn: r.warn };
}
