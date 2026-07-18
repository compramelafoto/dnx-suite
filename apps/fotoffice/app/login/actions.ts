"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma, type Prisma } from "@repo/db";
import { createFotofficeSessionForUser } from "@/lib/auth";
import { resolveFotofficePostLoginDestination } from "@/lib/post-login";
import { verifyPassword } from "@/lib/security/password";
import { FOTOFFICE_WORKSPACE_COOKIE } from "@/lib/courses-sales/constants";

const loginSelect = {
  id: true,
  password: true,
  role: true,
  globalRole: true,
  isBlocked: true,
} satisfies Prisma.UserSelect;

export type LoginFormState = { error: string | null };

export async function fotofficeLoginAction(
  _prev: LoginFormState | undefined,
  formData: FormData,
): Promise<LoginFormState> {
  const email = formData.get("email")?.toString()?.trim().toLowerCase();
  const password = formData.get("password")?.toString() ?? "";
  if (!email) return { error: "El email es obligatorio." };
  if (!password) return { error: "La contraseña es obligatoria." };

  let user: Prisma.UserGetPayload<{ select: typeof loginSelect }> | null;
  try {
    user = await prisma.user.findUnique({
      where: { email },
      select: loginSelect,
    });
  } catch {
    return {
      error: "No se pudo conectar a la base de datos. Revisá DATABASE_URL y migraciones.",
    };
  }
  if (!user) return { error: "No existe un usuario con ese email." };
  if (user.isBlocked) {
    return { error: "Tu cuenta está suspendida. Contactá al administrador." };
  }
  if (!user.password) {
    return { error: "Esta cuenta no tiene contraseña configurada. Usá Continuar con Google." };
  }
  if (!verifyPassword(password, user.password)) {
    return { error: "Email o contraseña incorrectos." };
  }

  try {
    await createFotofficeSessionForUser(user.id);
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    const dest = await resolveFotofficePostLoginDestination({ userId: user.id });
    if (dest.workspaceId) {
      const cookieStore = await cookies();
      cookieStore.set(FOTOFFICE_WORKSPACE_COOKIE, dest.workspaceId, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
      });
    }
    redirect(dest.path);
  } catch (e) {
    // redirect() throws; rethrow
    if (e && typeof e === "object" && "digest" in e) throw e;
    return { error: "No se pudo guardar la sesión." };
  }
}
