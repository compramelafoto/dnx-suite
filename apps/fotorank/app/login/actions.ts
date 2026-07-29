"use server";

import { redirect } from "next/navigation";
import { verifyUserPassword } from "@repo/auth";
import { createAdminSessionForUser } from "../lib/auth";
import { safeNextPath } from "../lib/safe-next-path";

export type LoginFormState = { error: string | null };

export async function loginAction(
  _prevState: LoginFormState | undefined,
  formData: FormData,
): Promise<LoginFormState> {
  const email = formData.get("email")?.toString()?.trim().toLowerCase();
  const password = formData.get("password")?.toString() ?? "";
  const next = safeNextPath(formData.get("next")?.toString());
  if (!email) return { error: "El email es obligatorio." };
  if (!password) return { error: "La contraseña es obligatoria." };

  let verified: Awaited<ReturnType<typeof verifyUserPassword>>;
  try {
    verified = await verifyUserPassword({ email, password });
  } catch {
    return {
      error:
        "No se pudo conectar a la base de datos. Revisá DATABASE_URL y migraciones.",
    };
  }
  if (!verified.ok) {
    if (verified.reason === "NOT_FOUND") {
      return { error: "No existe un usuario con ese email." };
    }
    if (verified.reason === "NO_PASSWORD") {
      return {
        error:
          "Esta cuenta no tiene contraseña configurada. Ejecutá el seed o contactá al administrador.",
      };
    }
    return { error: "Email o contraseña incorrectos." };
  }

  try {
    await createAdminSessionForUser(verified.user.id);
  } catch {
    return { error: "No se pudo guardar la sesión." };
  }

  redirect(next ?? "/dashboard");
}
