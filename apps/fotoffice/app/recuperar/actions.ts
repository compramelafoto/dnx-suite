"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  requestPasswordReset,
  resetPasswordWithToken,
  passwordResetNeutralMessage,
  createUserSession,
  DNX_SESSION_COOKIE,
  DNX_SESSION_MAX_AGE_SECONDS,
} from "@repo/auth";

export type FotofficeResetFormState = { error: string | null; info: string | null };

function resolveAppBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_FOTOFFICE_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "";
  if (!raw) return "http://localhost:3003";
  return raw.replace(/\/$/, "");
}

export async function requestFotofficePasswordResetAction(
  _prev: FotofficeResetFormState | undefined,
  formData: FormData,
): Promise<FotofficeResetFormState> {
  const email = formData.get("email")?.toString() ?? "";
  if (!email.trim()) return { error: "El email es obligatorio.", info: null };

  await requestPasswordReset({
    email,
    appBaseUrl: resolveAppBaseUrl(),
    appLabel: "FotoOffice",
    resetPath: "/recuperar",
  });

  return { error: null, info: passwordResetNeutralMessage() };
}

export async function resetFotofficePasswordAction(
  _prev: FotofficeResetFormState | undefined,
  formData: FormData,
): Promise<FotofficeResetFormState> {
  const rawToken = formData.get("token")?.toString() ?? "";
  const password = formData.get("password")?.toString() ?? "";
  const passwordConfirm = formData.get("passwordConfirm")?.toString() ?? "";

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

  redirect("/");
}
