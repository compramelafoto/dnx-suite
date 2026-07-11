"use server";

import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { getAuthUser } from "@/lib/auth";
import {
  canAccessInfoSpotAdmin,
  canAccessInfoSpotRedaccion,
  getInfoSpotMembership,
  toPermissionSubject,
} from "@/lib/infospot-access";
import { verifyPassword } from "@/lib/password";
import { createInfoSpotSession, destroyInfoSpotSession } from "@/lib/session-cookie";

export type LoginFormState = { error: string | null };

function safeNextPath(raw: FormDataEntryValue | null): string {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value.startsWith("/") || value.startsWith("//")) return "/redaccion";
  return value;
}

export async function loginAction(
  _prev: LoginFormState | undefined,
  formData: FormData,
): Promise<LoginFormState> {
  const email = formData.get("email")?.toString()?.trim().toLowerCase();
  const password = formData.get("password")?.toString() ?? "";
  const next = safeNextPath(formData.get("next"));

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
  } catch {
    return {
      error: "No se pudo conectar a la base de datos. Revisá DATABASE_URL.",
    };
  }

  if (!user) return { error: "Email o contraseña incorrectos." };
  if (user.isBlocked) {
    return { error: "Esta cuenta está bloqueada. Contactá al Director." };
  }
  if (!user.password) {
    return {
      error:
        "Esta cuenta no tiene contraseña configurada. Usá el acceso DNX existente o pedí alta al Director.",
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
    return {
      error:
        "Acceso denegado: tu usuario DNX no tiene rol Info Spot (INFOSPOT_DIRECTOR o INFOSPOT_REDACTOR). Pedile al Director que te asigne en /admin/usuarios.",
    };
  }

  try {
    await createInfoSpotSession(user.id);
  } catch {
    return { error: "No se pudo guardar la sesión." };
  }

  redirect(next);
}

export async function logoutAction(): Promise<void> {
  await destroyInfoSpotSession();
  redirect("/ingresar");
}

/** Si ya hay sesión válida con acceso, ir directo a redacción. */
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
    redirect(safeNextPath(next));
  }
}
