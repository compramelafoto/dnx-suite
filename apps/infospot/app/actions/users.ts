"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import {
  canManageInfoSpotUsers,
  requireInfoSpotAdminAccess,
} from "@/lib/infospot-access";
import { revokeAllSessionsForUser } from "@/lib/session-cookie";

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

async function countActiveDirectors(excludeUserId?: number): Promise<number> {
  return prisma.infoSpotUserRole.count({
    where: {
      role: "INFOSPOT_DIRECTOR",
      status: "ACTIVE",
      ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
    },
  });
}

/**
 * Evita dejar Info Spot sin ningún DIRECTOR activo.
 * SUPER_ADMIN de suite no cuenta como fila editorial.
 */
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
      ok: false,
      message:
        "No hay cuenta DNX con ese email. La persona debe registrarse o iniciar sesión antes en la suite (ComprameLaFoto / FotoRank / seed). Info Spot no crea contraseñas propias.",
      user: null,
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
  };
}

/**
 * Alta / reactivación de miembro (DIRECTOR o REDACTOR).
 * No crea User nuevo.
 */
export async function assignInfoSpotMemberAction(
  _prev: UsersActionState,
  formData: FormData,
): Promise<UsersActionState> {
  const access = await requireDirector();
  if (!access) return deny();

  const email = formData.get("email")?.toString()?.trim().toLowerCase();
  const role = formData.get("role")?.toString() ?? "INFOSPOT_REDACTOR";
  const canPublish = formData.get("canPublish") === "on";

  if (!email) return { ok: false, message: "Email obligatorio." };
  if (role !== "INFOSPOT_DIRECTOR" && role !== "INFOSPOT_REDACTOR") {
    return { ok: false, message: "Rol inválido." };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, isBlocked: true },
  });
  if (!user) {
    return {
      ok: false,
      message:
        "No hay usuario DNX con ese email. Primero debe existir la cuenta en la suite.",
    };
  }
  if (user.isBlocked) {
    return { ok: false, message: "Ese usuario está bloqueado a nivel suite." };
  }

  const existing = await prisma.infoSpotUserRole.findUnique({
    where: { userId: user.id },
  });

  if (existing) {
    const leaveEmpty = await wouldLeaveNoActiveDirector({
      targetUserId: user.id,
      nextRole: role,
      nextStatus: "ACTIVE",
    });
    if (leaveEmpty) {
      return {
        ok: false,
        message:
          "No se puede cambiar el rol: quedaría Info Spot sin ningún Director activo.",
      };
    }
  }

  await prisma.infoSpotUserRole.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      role,
      canPublish: role === "INFOSPOT_DIRECTOR" ? true : canPublish,
      status: "ACTIVE",
      assignedByUserId: access.user.id,
      lastChangedByUserId: access.user.id,
    },
    update: {
      role,
      canPublish: role === "INFOSPOT_DIRECTOR" ? true : canPublish,
      status: "ACTIVE",
      lastChangedByUserId: access.user.id,
      assignedByUserId: existing?.assignedByUserId ?? access.user.id,
    },
  });

  revalidatePath("/admin/usuarios");
  const label = role === "INFOSPOT_DIRECTOR" ? "DIRECTOR" : "REDACTOR";
  return {
    ok: true,
    message: `${user.email} quedó como ${label} activo (canPublish=${
      role === "INFOSPOT_DIRECTOR" ? true : canPublish
    }). Cambio por ${access.user.email}.`,
  };
}

/** Compat: formulario legacy que solo asignaba redactora. */
export async function assignInfoSpotRedactorAction(
  prev: UsersActionState,
  formData: FormData,
): Promise<UsersActionState> {
  if (!formData.get("role")) {
    formData.set("role", "INFOSPOT_REDACTOR");
  }
  return assignInfoSpotMemberAction(prev, formData);
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
  const canPublish = formData.get("canPublish") === "on";

  if (!Number.isFinite(userId) || userId <= 0) {
    return { ok: false, message: "userId inválido." };
  }
  if (role !== "INFOSPOT_DIRECTOR" && role !== "INFOSPOT_REDACTOR") {
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
      canPublish: role === "INFOSPOT_DIRECTOR" ? true : canPublish,
      lastChangedByUserId: access.user.id,
    },
  });

  if (status === "DISABLED") {
    await revokeAllSessionsForUser(userId);
  }

  revalidatePath("/admin/usuarios");
  return {
    ok: true,
    message: `Miembro actualizado (${role.replace("INFOSPOT_", "")}, ${status}, publicar=${
      role === "INFOSPOT_DIRECTOR" ? true : canPublish
    }) por ${access.user.email}.`,
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
