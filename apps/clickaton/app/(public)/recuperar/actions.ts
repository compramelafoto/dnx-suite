"use server";

import { redirect } from "next/navigation";
import {
  requestPasswordReset,
  resetPasswordWithToken,
  passwordResetNeutralMessage,
  createUserSession,
  DNX_SESSION_COOKIE,
  DNX_SESSION_MAX_AGE_SECONDS,
} from "@repo/auth";
import { cookies } from "next/headers";
import { siteConfig } from "@/config/site";
import { CLICKATON_LOGIN_PATH } from "@/lib/auth/return-path";

export type ClickatonResetFormState = { error: string | null; info: string | null };

function resolveAppBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_CLICKATON_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "";
  if (!raw) return "http://localhost:3005";
  return raw.replace(/\/$/, "");
}

export async function requestClickatonPasswordResetAction(
  _prev: ClickatonResetFormState | undefined,
  formData: FormData,
): Promise<ClickatonResetFormState> {
  const email = formData.get("email")?.toString() ?? "";
  if (!email.trim()) {
    return { error: "El email es obligatorio.", info: null };
  }

  await requestPasswordReset({
    email,
    appBaseUrl: resolveAppBaseUrl(),
    appLabel: siteConfig.name,
    resetPath: "/recuperar",
  });

  return { error: null, info: passwordResetNeutralMessage() };
}

export async function resetClickatonPasswordAction(
  _prev: ClickatonResetFormState | undefined,
  formData: FormData,
): Promise<ClickatonResetFormState> {
  const rawToken = formData.get("token")?.toString() ?? "";
  const password = formData.get("password")?.toString() ?? "";
  const passwordConfirm = formData.get("passwordConfirm")?.toString() ?? "";

  if (!rawToken) {
    return { error: "Enlace inválido.", info: null };
  }

  try {
    const { userId } = await resetPasswordWithToken({
      rawToken,
      newPassword: password,
      passwordConfirm,
    });
    const session = await createUserSession(userId);
    const cookieStore = await cookies();
    cookieStore.set(DNX_SESSION_COOKIE, session.rawToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: DNX_SESSION_MAX_AGE_SECONDS,
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "No se pudo restablecer la contraseña.",
      info: null,
    };
  }

  redirect("/mi-cuenta");
}

export async function redirectToLoginAction(): Promise<void> {
  redirect(CLICKATON_LOGIN_PATH);
}
