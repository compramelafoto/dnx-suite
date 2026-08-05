"use server";

import { redirect } from "next/navigation";
import { DNX_AUTH_MESSAGES, verifyUserPassword } from "@repo/auth";
import { prisma } from "@repo/db";
import { createAdminSessionForUser } from "../lib/auth";
import { resolvePostLoginPathForUser } from "../lib/fotorank/access/home-capabilities";
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

  const profile = await prisma.user.findUnique({
    where: { id: verified.user.id },
    select: { email: true, globalRole: true },
  });

  const dest = await resolvePostLoginPathForUser({
    userId: verified.user.id,
    email: profile?.email ?? email,
    globalRole: profile?.globalRole ?? null,
    next,
  });
  redirect(dest);
}
