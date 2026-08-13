"use server";

import { revalidatePath } from "next/cache";
import {
  prisma,
  isInfoSpotEditorialRole,
  infoSpotRoleLabel,
  publicationPolicyLabel,
  resolveInfoSpotPublicationFields,
} from "@repo/db";
import {
  DNX_APP_INFOSPOT,
  inviteOrAssignAppAccess,
  listPendingInvitations,
  resendAppInvitation,
  revokeAppInvitation,
} from "@repo/auth";
import {
  canManageInfoSpotUsers,
  requireInfoSpotAdminAccess,
} from "@/lib/infospot-access";
import { revokeAllSessionsForUser } from "@/lib/session-cookie";
import { getSiteUrl } from "@/lib/settings";

export type UsersActionState = { ok: boolean; message: string };

export type LookupUserState = {
  ok: boolean;
  message: string;
  user?: {
    id: number;
    email: string;
    name: string | null;
    isBlocked: boolean;
    alreadyMember: boolean;
    currentRole: string | null;
    currentStatus: string | null;
  } | null;
  /** Si no hay User DNX, se puede invitar. */
  canInvite?: boolean;
  email?: string;
};

function deny(): UsersActionState {
  return { ok: false, message: "Sin permiso para gestionar el equipo editorial." };
}

async function requireDirector() {
  const access = await requireInfoSpotAdminAccess();
  if (!canManageInfoSpotUsers(access.subject)) {
    return null;
  }
  return access;
}

function resolveMembershipFields(role: string, formData: FormData) {
  const policyFromForm = formData.get("publicationPolicy")?.toString();
  const publicationPolicy =
    policyFromForm === "REQUIRES_APPROVAL" || policyFromForm === "DIRECT_PUBLISH"
      ? policyFromForm
      : formData.get("canPublish") === "on"
        ? "DIRECT_PUBLISH"
        : "REQUIRES_APPROVAL";

  const pub = resolveInfoSpotPublicationFields({
    role,
    publicationPolicy,
    canPublish: publicationPolicy === "DIRECT_PUBLISH",
  });

  // Director siempre puede provisionar CLF. Resto: checkbox del formulario.
  const canProvisionClfPhotographerCall =
    role === "INFOSPOT_DIRECTOR" ||
    formData.get("canProvisionClfPhotographerCall") === "on" ||
    formData.get("canProvisionClfPhotographerCall") === "true";

  // Independiente de provisioning: avisar fotógrafos cercanos.
  const canNotifyClfPhotographerCall =
    role === "INFOSPOT_DIRECTOR" ||
    formData.get("canNotifyClfPhotographerCall") === "on" ||
    formData.get("canNotifyClfPhotographerCall") === "true";

  return {
    ...pub,
    canProvisionClfPhotographerCall,
    canNotifyClfPhotographerCall,
  };
}

async function countActiveDirectors(excludeUserId?: number): Promise<number> {
  return prisma.infoSpotUserRole.count({
    where: {
      role: "INFOSPOT_DIRECTOR",
      status: "ACTIVE",
      ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
    },
  });
}

async function wouldLeaveNoActiveDirector(params: {
  targetUserId: number;
  nextRole: string;
  nextStatus: string;
}): Promise<boolean> {
  const current = await prisma.infoSpotUserRole.findUnique({
    where: { userId: params.targetUserId },
  });
  if (!current) return false;

  const wasActiveDirector =
    current.role === "INFOSPOT_DIRECTOR" && current.status === "ACTIVE";
  if (!wasActiveDirector) return false;

  const remainsActiveDirector =
    params.nextRole === "INFOSPOT_DIRECTOR" && params.nextStatus === "ACTIVE";
  if (remainsActiveDirector) return false;

  const others = await countActiveDirectors(params.targetUserId);
  return others === 0;
}

async function upsertInfoSpotMembership(params: {
  userId: number;
  role: string;
  publicationPolicy: string;
  canPublish: boolean;
  canProvisionClfPhotographerCall: boolean;
  canNotifyClfPhotographerCall: boolean;
  actorUserId: number;
}) {
  const existing = await prisma.infoSpotUserRole.findUnique({
    where: { userId: params.userId },
  });

  if (existing) {
    const leaveEmpty = await wouldLeaveNoActiveDirector({
      targetUserId: params.userId,
      nextRole: params.role,
      nextStatus: "ACTIVE",
    });
    if (leaveEmpty) {
      throw new Error(
        "No se puede cambiar el rol: quedaría Info Spot sin ningún Director activo.",
      );
    }
  }

  const fields = resolveInfoSpotPublicationFields({
    role: params.role,
    publicationPolicy: params.publicationPolicy,
    canPublish: params.canPublish,
  });
  const canProvision =
    params.role === "INFOSPOT_DIRECTOR" || params.canProvisionClfPhotographerCall;
  const canNotify =
    params.role === "INFOSPOT_DIRECTOR" || params.canNotifyClfPhotographerCall;

  await prisma.infoSpotUserRole.upsert({
    where: { userId: params.userId },
    create: {
      userId: params.userId,
      role: params.role as "INFOSPOT_DIRECTOR" | "INFOSPOT_REDACTOR" | "INFOSPOT_COLABORADOR",
      canPublish: fields.canPublish,
      publicationPolicy: fields.publicationPolicy,
      canProvisionClfPhotographerCall: canProvision,
      canNotifyClfPhotographerCall: canNotify,
      status: "ACTIVE",
      assignedByUserId: params.actorUserId,
      lastChangedByUserId: params.actorUserId,
    },
    update: {
      role: params.role as "INFOSPOT_DIRECTOR" | "INFOSPOT_REDACTOR" | "INFOSPOT_COLABORADOR",
      canPublish: fields.canPublish,
      publicationPolicy: fields.publicationPolicy,
      canProvisionClfPhotographerCall: canProvision,
      canNotifyClfPhotographerCall: canNotify,
      status: "ACTIVE",
      lastChangedByUserId: params.actorUserId,
      assignedByUserId: existing?.assignedByUserId ?? params.actorUserId,
    },
  });
}

function emailStatusNote(result: { sent: boolean; skipped: boolean; reason?: string }): string {
  if (result.sent) return " Email enviado.";
  if (result.skipped) return " Email no enviado (servicio no configurado); usá el enlace o reenviá luego.";
  return ` Email falló: ${result.reason ?? "error desconocido"}.`;
}

/** Preview: buscar User DNX por email (sin crear). */
export async function lookupDnxUserByEmailAction(
  _prev: LookupUserState,
  formData: FormData,
): Promise<LookupUserState> {
  const access = await requireDirector();
  if (!access) {
    return { ok: false, message: "Sin permiso.", user: null };
  }

  const email = formData.get("email")?.toString()?.trim().toLowerCase();
  if (!email) return { ok: false, message: "Email obligatorio.", user: null };

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, isBlocked: true },
  });
  if (!user) {
    return {
      ok: true,
      message:
        "No hay cuenta DNX con ese email. Podés enviar una invitación para que cree su identidad y se una al equipo.",
      user: null,
      canInvite: true,
      email,
    };
  }

  const membership = await prisma.infoSpotUserRole.findUnique({
    where: { userId: user.id },
    select: { role: true, status: true },
  });

  return {
    ok: true,
    message: membership
      ? "Usuario encontrado: ya es miembro del equipo. Podés actualizar rol y permisos abajo."
      : "Usuario DNX encontrado. Podés asignarlo al equipo editorial.",
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      isBlocked: user.isBlocked,
      alreadyMember: Boolean(membership),
      currentRole: membership?.role ?? null,
      currentStatus: membership?.status ?? null,
    },
    canInvite: false,
    email,
  };
}

/**
 * Invita por email (User nuevo) o asigna rol (User existente).
 * Parte de DNX Identity — no crea contraseñas temporales.
 */
export async function inviteOrAssignInfoSpotMemberAction(
  _prev: UsersActionState,
  formData: FormData,
): Promise<UsersActionState> {
  const access = await requireDirector();
  if (!access) return deny();

  const email = formData.get("email")?.toString()?.trim().toLowerCase();
  const role = formData.get("role")?.toString() ?? "INFOSPOT_REDACTOR";
  const fields = resolveMembershipFields(role, formData);

  if (!email) return { ok: false, message: "Email obligatorio." };
  if (!isInfoSpotEditorialRole(role)) {
    return { ok: false, message: "Rol inválido." };
  }

  try {
    const result = await inviteOrAssignAppAccess({
      email,
      app: DNX_APP_INFOSPOT,
      appRole: role,
      canPublish: fields.canPublish,
      invitedByUserId: access.user.id,
      appBaseUrl: getSiteUrl(),
      appLabel: "Info Spot",
      roleLabel: infoSpotRoleLabel(role),
      loginPath: "/ingresar",
      invitePath: "/invitar",
      onAssignExistingUser: async (userId) => {
        await upsertInfoSpotMembership({
          userId,
          role,
          publicationPolicy: fields.publicationPolicy,
          canPublish: fields.canPublish,
          canProvisionClfPhotographerCall: fields.canProvisionClfPhotographerCall,
          canNotifyClfPhotographerCall: fields.canNotifyClfPhotographerCall,
          actorUserId: access.user.id,
        });
      },
    });

    revalidatePath("/admin/usuarios");

    if (result.kind === "assigned_existing") {
      return {
        ok: true,
        message: `${result.email} quedó como ${infoSpotRoleLabel(role)} activo (${publicationPolicyLabel(fields.publicationPolicy)}).${emailStatusNote(result.emailResult)}`,
      };
    }

    return {
      ok: true,
      message: `Invitación ${result.kind === "invitation_resent" ? "reenviada" : "creada"} para ${result.email} (${infoSpotRoleLabel(role)}, ${publicationPolicyLabel(fields.publicationPolicy)}).${emailStatusNote(result.emailResult)} Enlace: ${result.inviteUrl}`,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "No se pudo invitar o asignar.",
    };
  }
}

/** Compat: asignar miembro existente (sin invitación). */
export async function assignInfoSpotMemberAction(
  prev: UsersActionState,
  formData: FormData,
): Promise<UsersActionState> {
  return inviteOrAssignInfoSpotMemberAction(prev, formData);
}

export async function assignInfoSpotRedactorAction(
  prev: UsersActionState,
  formData: FormData,
): Promise<UsersActionState> {
  if (!formData.get("role")) {
    formData.set("role", "INFOSPOT_REDACTOR");
  }
  return inviteOrAssignInfoSpotMemberAction(prev, formData);
}

export async function resendInfoSpotInvitationAction(
  _prev: UsersActionState,
  formData: FormData,
): Promise<UsersActionState> {
  const access = await requireDirector();
  if (!access) return deny();

  const invitationId = formData.get("invitationId")?.toString();
  if (!invitationId) return { ok: false, message: "Invitación inválida." };

  try {
    const pending = await listPendingInvitations({ app: DNX_APP_INFOSPOT });
    const row = pending.find((i) => i.id === invitationId);
    if (!row) return { ok: false, message: "Invitación no encontrada." };

    const result = await resendAppInvitation({
      invitationId,
      invitedByUserId: access.user.id,
      appBaseUrl: getSiteUrl(),
      appLabel: "Info Spot",
      roleLabel: infoSpotRoleLabel(row.appRole),
      invitePath: "/invitar",
    });

    revalidatePath("/admin/usuarios");
    return {
      ok: true,
      message: `Invitación reenviada a ${row.email}.${emailStatusNote(result.emailResult)} Enlace: ${result.inviteUrl}`,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "No se pudo reenviar.",
    };
  }
}

export async function revokeInfoSpotInvitationAction(
  _prev: UsersActionState,
  formData: FormData,
): Promise<UsersActionState> {
  const access = await requireDirector();
  if (!access) return deny();

  const invitationId = formData.get("invitationId")?.toString();
  if (!invitationId) return { ok: false, message: "Invitación inválida." };

  try {
    await revokeAppInvitation(invitationId);
    revalidatePath("/admin/usuarios");
    return { ok: true, message: "Invitación revocada." };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "No se pudo revocar.",
    };
  }
}

export async function updateInfoSpotMemberAction(
  _prev: UsersActionState,
  formData: FormData,
): Promise<UsersActionState> {
  const access = await requireDirector();
  if (!access) return deny();

  const userId = Number(formData.get("userId"));
  const role = formData.get("role")?.toString();
  const status = formData.get("status")?.toString();
  const fields = role ? resolveMembershipFields(role, formData) : null;

  if (!Number.isFinite(userId) || userId <= 0) {
    return { ok: false, message: "userId inválido." };
  }
  if (!role || !isInfoSpotEditorialRole(role) || !fields) {
    return { ok: false, message: "Rol inválido." };
  }
  if (status !== "ACTIVE" && status !== "DISABLED") {
    return { ok: false, message: "Estado inválido." };
  }

  if (userId === access.user.id && status === "DISABLED") {
    return { ok: false, message: "No podés desactivarte a vos mismo." };
  }
  if (userId === access.user.id && role !== "INFOSPOT_DIRECTOR") {
    return { ok: false, message: "No podés quitarte el rol de Director a vos mismo." };
  }

  const row = await prisma.infoSpotUserRole.findUnique({ where: { userId } });
  if (!row) return { ok: false, message: "Miembro no encontrado." };

  if (
    await wouldLeaveNoActiveDirector({
      targetUserId: userId,
      nextRole: role,
      nextStatus: status,
    })
  ) {
    return {
      ok: false,
      message:
        "No se puede aplicar el cambio: Info Spot quedaría sin ningún Director activo.",
    };
  }

  await prisma.infoSpotUserRole.update({
    where: { userId },
    data: {
      role,
      status,
      canPublish: fields.canPublish,
      publicationPolicy: fields.publicationPolicy,
      canProvisionClfPhotographerCall:
        role === "INFOSPOT_DIRECTOR" || fields.canProvisionClfPhotographerCall,
      canNotifyClfPhotographerCall:
        role === "INFOSPOT_DIRECTOR" || fields.canNotifyClfPhotographerCall,
      lastChangedByUserId: access.user.id,
    },
  });

  if (status === "DISABLED") {
    await revokeAllSessionsForUser(userId);
  }

  revalidatePath("/admin/usuarios");
  revalidatePath("/admin/aprobaciones");
  revalidatePath("/");
  revalidatePath("/noticias");
  return {
    ok: true,
    message: `Miembro actualizado (${infoSpotRoleLabel(role)}, ${status}, ${publicationPolicyLabel(fields.publicationPolicy)}) por ${access.user.email}.`,
  };
}

export async function revokeInfoSpotAccessAction(
  _prev: UsersActionState,
  formData: FormData,
): Promise<UsersActionState> {
  const access = await requireDirector();
  if (!access) return deny();

  const userId = Number(formData.get("userId"));
  if (!Number.isFinite(userId) || userId <= 0) {
    return { ok: false, message: "userId inválido." };
  }
  if (userId === access.user.id) {
    return { ok: false, message: "No podés revocar tu propio acceso." };
  }

  const row = await prisma.infoSpotUserRole.findUnique({ where: { userId } });
  if (!row) return { ok: false, message: "Miembro no encontrado." };

  if (
    await wouldLeaveNoActiveDirector({
      targetUserId: userId,
      nextRole: row.role,
      nextStatus: "DISABLED",
    })
  ) {
    return {
      ok: false,
      message:
        "No se puede revocar: es el único Director activo. Asigná otro Director antes.",
    };
  }

  await prisma.infoSpotUserRole.update({
    where: { userId },
    data: {
      status: "DISABLED",
      lastChangedByUserId: access.user.id,
    },
  });
  await revokeAllSessionsForUser(userId);

  revalidatePath("/admin/usuarios");
  return {
    ok: true,
    message: `Acceso revocado (desactivado + sesiones cerradas) por ${access.user.email}.`,
  };
}

export async function closeInfoSpotMemberSessionsAction(
  _prev: UsersActionState,
  formData: FormData,
): Promise<UsersActionState> {
  const access = await requireDirector();
  if (!access) return deny();

  const userId = Number(formData.get("userId"));
  if (!Number.isFinite(userId) || userId <= 0) {
    return { ok: false, message: "userId inválido." };
  }
  if (userId === access.user.id) {
    return {
      ok: false,
      message: "Para cerrar tu propia sesión usá «Cerrar sesión» en Redacción.",
    };
  }

  const row = await prisma.infoSpotUserRole.findUnique({ where: { userId } });
  if (!row) return { ok: false, message: "Miembro no encontrado." };

  await revokeAllSessionsForUser(userId);
  await prisma.infoSpotUserRole.update({
    where: { userId },
    data: { lastChangedByUserId: access.user.id },
  });

  revalidatePath("/admin/usuarios");
  return {
    ok: true,
    message: `Sesiones cerradas para el miembro. Acción de ${access.user.email}.`,
  };
}
