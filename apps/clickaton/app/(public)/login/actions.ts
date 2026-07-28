"use server";

import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { verifyPassword } from "@repo/auth";
import { normalizeEmail } from "@/config/admin/admins";
import {
  createClickatonSession,
  destroyClickatonSession,
} from "@/lib/admin/auth";
import { resolveClickatonPostLoginPath } from "@/lib/auth/post-login";
import {
  CLICKATON_LOGIN_PATH,
  sanitizeClickatonReturnPath,
} from "@/lib/auth/return-path";
import { routes } from "@/config/navigation";

export type ClickatonLoginFormState = { error: string | null };

export async function loginClickatonAction(
  _prevState: ClickatonLoginFormState | undefined,
  formData: FormData,
): Promise<ClickatonLoginFormState> {
  const email = normalizeEmail(formData.get("email")?.toString() ?? "");
  const password = formData.get("password")?.toString() ?? "";
  const nextRaw = formData.get("next")?.toString();

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
        "Esta cuenta no tiene contraseña configurada. Usá Continuar con Google.",
    };
  }
  if (!verifyPassword(password, user.password)) {
    return { error: "Email o contraseña incorrectos." };
  }

  try {
    await createClickatonSession(user.id);
  } catch {
    return { error: "No se pudo guardar la sesión." };
  }

  const globalRole = user.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "USER";
  const destination = resolveClickatonPostLoginPath({
    email: user.email,
    globalRole,
    next: nextRaw,
  });

  redirect(destination.path);
}

export async function logoutClickatonAction(): Promise<void> {
  await destroyClickatonSession();
  redirect(routes.home);
}

/** Cierra sesión y vuelve al login unificado (cambio de cuenta sin loop). */
export async function logoutClickatonToLoginAction(): Promise<void> {
  await destroyClickatonSession();
  redirect(CLICKATON_LOGIN_PATH);
}

/** Compat panel admin — mismo cierre de sesión hacia el sitio público. */
export async function logoutAdminAction(): Promise<void> {
  await destroyClickatonSession();
  redirect(routes.home);
}

export { sanitizeClickatonReturnPath };
