"use server";

import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { verifyPassword } from "@repo/auth";
import { adminRoutes } from "@/config/admin/navigation";
import { hasClickatonAdminAccess } from "@/lib/admin/access";
import {
  createClickatonSession,
  destroyClickatonSession,
  sanitizeAdminReturnPath,
} from "@/lib/admin/auth";
import { normalizeEmail } from "@/config/admin/admins";

export type AdminLoginFormState = { error: string | null };

export async function loginAdminAction(
  _prevState: AdminLoginFormState | undefined,
  formData: FormData,
): Promise<AdminLoginFormState> {
  const email = normalizeEmail(formData.get("email")?.toString() ?? "");
  const password = formData.get("password")?.toString() ?? "";
  const next = sanitizeAdminReturnPath(formData.get("next")?.toString());

  if (!email) return { error: "El email es obligatorio." };
  if (!password) return { error: "La contraseña es obligatoria." };

  let user: {
    id: number;
    email: string;
    password: string | null;
    role: string;
    isBlocked: boolean;
  } | null;

  try {
    user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        role: true,
        isBlocked: true,
      },
    });
  } catch {
    return {
      error:
        "No se pudo conectar a la base de datos. Revisá DATABASE_URL y el entorno.",
    };
  }

  if (!user || user.isBlocked) {
    return { error: "Email o contraseña incorrectos." };
  }
  if (!user.password) {
    return {
      error:
        "Esta cuenta no tiene contraseña configurada. Contactá al administrador de DNX Identity.",
    };
  }
  if (!verifyPassword(password, user.password)) {
    return { error: "Email o contraseña incorrectos." };
  }

  const globalRole = user.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "USER";
  if (!hasClickatonAdminAccess({ email: user.email, globalRole })) {
    return {
      error: "Tu cuenta no tiene permiso para administrar Clickatón.",
    };
  }

  try {
    await createClickatonSession(user.id);
  } catch {
    return { error: "No se pudo guardar la sesión." };
  }

  redirect(next);
}

export async function logoutAdminAction(): Promise<void> {
  await destroyClickatonSession();
  redirect(adminRoutes.login);
}
