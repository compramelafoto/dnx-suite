"use server";

import { redirect } from "next/navigation";
import { verifyUserPassword } from "@repo/auth";
import { normalizeEmail } from "@/config/admin/admins";
import {
  createClickatonSession,
  destroyClickatonSession,
} from "@/lib/admin/auth";
import { resolveClickatonPostLoginPath } from "@/lib/auth/post-login";
import { CLICKATON_LOGIN_PATH } from "@/lib/auth/return-path";
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

  let verified: Awaited<ReturnType<typeof verifyUserPassword>>;
  try {
    verified = await verifyUserPassword({ email, password });
  } catch {
    return {
      error:
        "No se pudo conectar a la base de datos. Revisá DATABASE_URL y el entorno.",
    };
  }

  if (!verified.ok) {
    if (verified.reason === "NO_PASSWORD") {
      return {
        error:
          "Esta cuenta no tiene contraseña configurada. Usá Continuar con Google.",
      };
    }
    return { error: "Email o contraseña incorrectos." };
  }

  const user = verified.user;

  try {
    await createClickatonSession(user.id);
  } catch {
    return { error: "No se pudo guardar la sesión." };
  }

  const globalRole =
    user.role === "SUPER_ADMIN" || user.globalRole === "SUPER_ADMIN"
      ? "SUPER_ADMIN"
      : "USER";
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
