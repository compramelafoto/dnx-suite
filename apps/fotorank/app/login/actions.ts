"use server";

import { redirect } from "next/navigation";
import { prisma, type Prisma } from "@repo/db";
import { createAdminSessionForUser } from "../lib/auth";
import { verifyPassword } from "../lib/security/password";

/** Select alineado con `User` en schema Prisma (login admin Fotorank). */
const loginAdminUserSelect = {
  id: true,
  password: true,
} satisfies Prisma.UserSelect;

export type LoginFormState = { error: string | null };

export async function loginAction(
  _prevState: LoginFormState | undefined,
  formData: FormData,
): Promise<LoginFormState> {
  const email = formData.get("email")?.toString()?.trim().toLowerCase();
  const password = formData.get("password")?.toString() ?? "";
  if (!email) return { error: "El email es obligatorio." };
  if (!password) return { error: "La contraseña es obligatoria." };

  let user: Prisma.UserGetPayload<{ select: typeof loginAdminUserSelect }> | null;
  try {
    user = await prisma.user.findUnique({
      where: { email },
      select: loginAdminUserSelect,
    });
  } catch {
    return {
      error:
        "No se pudo conectar a la base de datos. Revisá DATABASE_URL y migraciones.",
    };
  }
  if (!user) return { error: "No existe un usuario con ese email." };
  if (!user.password) {
    return { error: "Esta cuenta no tiene contraseña configurada. Ejecutá el seed o contactá al administrador." };
  }
  if (!verifyPassword(password, user.password)) {
    return { error: "Email o contraseña incorrectos." };
  }

  try {
    await createAdminSessionForUser(user.id);
  } catch {
    return { error: "No se pudo guardar la sesión." };
  }

  redirect("/dashboard");
}
