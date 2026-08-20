"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { DNX_AUTH_MESSAGES, verifyUserPassword } from "@repo/auth";
import { createAdminSessionForUser } from "../lib/auth";
import { classifyFailure, resolvePostLoginPathForUser } from "../lib/fotorank/access/home-capabilities";
import { safeNextPath } from "../lib/safe-next-path";

export type LoginFormState = { error: string | null };

const UNAVAILABLE_PATH = "/cuenta/no-disponible";

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

  // Contraseña validada y sesión ya creada: de acá en más, cualquier falla
  // NO debe destruir la sesión ni mostrar la pantalla genérica de error. Los
  // rechazos de las 3 consultas de capacidades ya se resuelven fail-closed
  // dentro de `resolveHomeCapabilities` (no propagan). Este try/catch es la
  // red de seguridad para lo que quede FUERA de eso — p. ej. una excepción
  // inesperada al armar el resultado. `verified.user` ya trae email/globalRole
  // del mismo query de contraseña — no hace falta una segunda consulta a `User`.
  let dest: string;
  try {
    dest = await resolvePostLoginPathForUser({
      userId: verified.user.id,
      email: verified.user.email,
      globalRole: verified.user.globalRole,
      next,
    });
  } catch (err) {
    const incidentId = randomUUID();
    const { category, code } = classifyFailure(err);
    console.error("FOTORANK_LOGIN_POST_AUTH_FAILURE", { incidentId, category, code });
    redirect(`${UNAVAILABLE_PATH}?incident=${incidentId}`);
  }
  redirect(dest);
}
