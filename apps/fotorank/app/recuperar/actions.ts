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

export type FotorankResetFormState = { error: string | null; info: string | null };

function resolveAppBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_FOTORANK_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "";
  if (!raw) return "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

export async function requestFotorankPasswordResetAction(
  _prev: FotorankResetFormState | undefined,
  formData: FormData,
): Promise<FotorankResetFormState> {
  const email = formData.get("email")?.toString() ?? "";
  if (!email.trim()) return { error: "El email es obligatorio.", info: null };

  await requestPasswordReset({
    email,
    appBaseUrl: resolveAppBaseUrl(),
    appLabel: "FotoRank",
    resetPath: "/recuperar",
  });

  return { error: null, info: passwordResetNeutralMessage() };
}

export async function resetFotorankPasswordAction(
  _prev: FotorankResetFormState | undefined,
  formData: FormData,
): Promise<FotorankResetFormState> {
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

  redirect("/participaciones");
}
