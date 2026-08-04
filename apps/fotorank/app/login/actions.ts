"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { DNX_AUTH_MESSAGES, verifyUserPassword } from "@repo/auth";
import { createAdminSessionForUser } from "../lib/auth";
import { safeNextPath } from "../lib/safe-next-path";
import {
  RATE_LIMITS,
  clientIpFromHeaders,
  consumeRateLimit,
} from "../lib/fotorank/security/rate-limit";

export type LoginFormState = { error: string | null };

export async function loginAction(
  _prevState: LoginFormState | undefined,
  formData: FormData,
): Promise<LoginFormState> {
  const h = await headers();
  const rl = consumeRateLimit("auth.login", clientIpFromHeaders(h), RATE_LIMITS.login);
  if (!rl.allowed) {
    return { error: "Demasiados intentos. Probá de nuevo en unos segundos." };
  }

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
    if (verified.reason === "NO_PASSWORD") {
      return { error: DNX_AUTH_MESSAGES.noPasswordUseGoogle };
    }
    return { error: DNX_AUTH_MESSAGES.loginInvalid };
  }

  try {
    await createAdminSessionForUser(verified.user.id);
  } catch {
    return { error: "No se pudo guardar la sesión." };
  }

  redirect(next ?? "/dashboard");
}
