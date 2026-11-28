"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DNX_AUTH_MESSAGES, sanitizeReturnTo, verifyUserPassword } from "@repo/auth";
import { prisma } from "@repo/db";
import { checkRateLimit } from "@/lib/limite";
import { abrirSesion } from "@/lib/sesion";

export type LoginFormState = { error: string | null };

// Por IP y por correo: frena el probar claves sin molestar a quien se equivoca un par de veces.
const FRENO = { limit: 10, windowMs: 15 * 60_000 };

export async function loginAction(
  _prev: LoginFormState | undefined,
  formData: FormData,
): Promise<LoginFormState> {
  const email = formData.get("email")?.toString().trim().toLowerCase() ?? "";
  const password = formData.get("password")?.toString() ?? "";
  const returnTo = sanitizeReturnTo(formData.get("returnTo")?.toString(), {
    fallback: "/cuenta/verificacion",
  });
  if (!email) return { error: "El correo es obligatorio." };
  if (!password) return { error: "La contraseña es obligatoria." };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "sin-ip";
  const porIp = checkRateLimit({ key: `clave:ip:${ip}`, ...FRENO });
  const porCorreo = checkRateLimit({ key: `clave:correo:${email}`, ...FRENO });
  if (!porIp.allowed || !porCorreo.allowed) {
    return { error: "Demasiados intentos. Esperá unos minutos y probá de nuevo." };
  }

  let verificado: Awaited<ReturnType<typeof verifyUserPassword>>;
  try {
    verificado = await verifyUserPassword({ email, password });
  } catch (err) {
    console.error("[equipos] error al verificar la contraseña", err);
    return { error: "No pudimos completar el ingreso. Volvé a intentarlo." };
  }
  if (!verificado.ok) {
    return {
      error:
        verificado.reason === "NO_PASSWORD"
          ? DNX_AUTH_MESSAGES.noPasswordUseGoogle
          : DNX_AUTH_MESSAGES.loginInvalid,
    };
  }

  // El rol de la cuenta no se toca: quien ya existe en ComprameLaFoto entra con el que tiene.
  await prisma.user.update({
    where: { id: verificado.user.id },
    data: { lastLoginAt: new Date() },
  });
  await abrirSesion(verificado.user.id);
  redirect(returnTo);
}
