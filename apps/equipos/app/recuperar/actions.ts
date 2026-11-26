"use server";

import { redirect } from "next/navigation";
import {
  passwordResetNeutralMessage,
  requestPasswordReset,
  resetPasswordWithToken,
} from "@repo/auth";
import { abrirSesion, urlBaseDeLaApp } from "@/lib/sesion";

export type ResetFormState = { error: string | null; info: string | null };

export async function requestPasswordResetAction(
  _prev: ResetFormState | undefined,
  formData: FormData,
): Promise<ResetFormState> {
  const email = formData.get("email")?.toString() ?? "";
  if (!email.trim()) return { error: "El correo es obligatorio.", info: null };

  await requestPasswordReset({
    email,
    appBaseUrl: urlBaseDeLaApp(),
    appLabel: "Equipos verificados",
    resetPath: "/recuperar",
  });

  // Mensaje neutro: no revela si el correo tiene cuenta.
  return { error: null, info: passwordResetNeutralMessage() };
}

export async function resetPasswordAction(
  _prev: ResetFormState | undefined,
  formData: FormData,
): Promise<ResetFormState> {
  try {
    const { userId } = await resetPasswordWithToken({
      rawToken: formData.get("token")?.toString() ?? "",
      newPassword: formData.get("password")?.toString() ?? "",
      passwordConfirm: formData.get("passwordConfirm")?.toString() ?? "",
    });
    await abrirSesion(userId);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "No se pudo restablecer la contraseña.",
      info: null,
    };
  }
  redirect("/cuenta/verificacion");
}
