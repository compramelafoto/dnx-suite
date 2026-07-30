"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@repo/db";
import { createFotofficeSessionForUser } from "@/lib/auth";
import { resolveFotofficePostLoginDestination } from "@/lib/post-login";
import { verifyUserPassword } from "@repo/auth";
import { FOTOFFICE_WORKSPACE_COOKIE } from "@/lib/courses-sales/constants";

export type LoginFormState = { error: string | null };

export async function fotofficeLoginAction(
  _prev: LoginFormState | undefined,
  formData: FormData,
): Promise<LoginFormState> {
  const email = formData.get("email")?.toString()?.trim().toLowerCase();
  const password = formData.get("password")?.toString() ?? "";
  if (!email) return { error: "El email es obligatorio." };
  if (!password) return { error: "La contraseña es obligatoria." };

  let verified: Awaited<ReturnType<typeof verifyUserPassword>>;
  try {
    verified = await verifyUserPassword({ email, password });
  } catch {
    return {
      error: "No se pudo conectar a la base de datos. Revisá DATABASE_URL y migraciones.",
    };
  }
  if (!verified.ok) {
    if (verified.reason === "BLOCKED") {
      return { error: "Tu cuenta está suspendida. Contactá al administrador." };
    }
    if (verified.reason === "NO_PASSWORD") {
      return {
        error:
          "Esta cuenta no tiene contraseña configurada. Usá Continuar con Google o restablecé tu acceso.",
      };
    }
    // Anti-enumeración: mismo mensaje para NOT_FOUND e invalid password.
    return { error: "Email o contraseña incorrectos." };
  }

  const user = verified.user;

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
