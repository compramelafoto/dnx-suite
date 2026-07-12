"use server";

import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { verifyPassword } from "@repo/auth";
import { getAuthUser } from "@/lib/auth";
import {
  canAccessInfoSpotAdmin,
  canAccessInfoSpotRedaccion,
  getInfoSpotMembership,
  toPermissionSubject,
} from "@/lib/infospot-access";
import { createInfoSpotSession, destroyInfoSpotSession } from "@/lib/session-cookie";
import {
  loadPostLoginDestination,
  safeInfoSpotNextPath,
} from "@/lib/google-login";

export type LoginFormState = { error: string | null };

export async function loginAction(
  _prev: LoginFormState | undefined,
  formData: FormData,
): Promise<LoginFormState> {
  const email = formData.get("email")?.toString()?.trim().toLowerCase();
  const password = formData.get("password")?.toString() ?? "";
  const rememberMe = formData.get("rememberMe") === "on";
  const next = safeInfoSpotNextPath(formData.get("next")?.toString());

  if (!email) return { error: "El email es obligatorio." };
  if (!password) return { error: "La contraseña es obligatoria." };

  let user: {
    id: number;
    password: string | null;
    isBlocked: boolean;
    role: string;
  } | null;
  try {
    user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, password: true, isBlocked: true, role: true },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/not found in enum ['"]Role['"]/i.test(message) || /SUPER_ADMIN/i.test(message)) {
      return {
        error:
          "El cliente de base de datos está desactualizado respecto al rol SUPER_ADMIN. Regenerá Prisma Client y redeployá Info Spot.",
      };
    }
    if (/P1001|P1017|Can't reach|ECONNREFUSED|ENOTFOUND|connection/i.test(message)) {
      return {
        error: "No se pudo conectar a la base de datos. Revisá DATABASE_URL.",
      };
    }
    console.error("[infospot/login] prisma.user.findUnique failed:", message);
    return {
      error: "No se pudo verificar el usuario. Revisá logs del servidor.",
    };
  }

  if (!user) return { error: "Email o contraseña incorrectos." };
  if (user.isBlocked) {
    return { error: "Esta cuenta está bloqueada. Contactá al Director." };
  }
  if (!user.password) {
    return {
      error:
        "Esta cuenta no tiene contraseña. Usá «Continuar con Google», el enlace de invitación o recuperá el acceso.",
    };
  }
  if (!verifyPassword(password, user.password)) {
    return { error: "Email o contraseña incorrectos." };
  }

  const isSuperAdmin = user.role === "SUPER_ADMIN";
  const membership = await getInfoSpotMembership(user.id);
  const subject = toPermissionSubject(
    {
      id: user.id,
      name: null,
      email,
      role: user.role,
      globalRole: isSuperAdmin ? "SUPER_ADMIN" : "USER",
      currentWorkspaceId: null,
      workspaceRole: null,
      appAccess: [],
    },
    membership,
  );

  const canEnter =
    isSuperAdmin ||
    canAccessInfoSpotRedaccion(subject) ||
    canAccessInfoSpotAdmin(subject);

  if (!canEnter) {
    try {
      await createInfoSpotSession(user.id, { rememberMe });
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    } catch {
      return { error: "No se pudo guardar la sesión." };
    }
    redirect(
      "/ingresar/acceso-pendiente?notice=" +
        encodeURIComponent(
          "Tu cuenta DNX existe, pero todavía no tenés acceso a Info Spot. Pedile una invitación al Director.",
        ),
    );
  }

  try {
    await createInfoSpotSession(user.id, { rememberMe });
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
  } catch {
    return { error: "No se pudo guardar la sesión." };
  }

  const destination = await loadPostLoginDestination(user.id, user.role, next);
  redirect(destination.path);
}

export async function logoutAction(): Promise<void> {
  await destroyInfoSpotSession();
  redirect("/ingresar");
}

/** Si ya hay sesión válida con acceso, ir directo al destino. */
export async function redirectIfAlreadySignedIn(next = "/redaccion") {
  const user = await getAuthUser();
  if (!user) return;
  const membership = await getInfoSpotMembership(user.id);
  const subject = toPermissionSubject(user, membership);
  if (
    user.globalRole === "SUPER_ADMIN" ||
    canAccessInfoSpotRedaccion(subject) ||
    canAccessInfoSpotAdmin(subject)
  ) {
    const destination = await loadPostLoginDestination(user.id, user.role, next);
    redirect(destination.path);
  }
}
