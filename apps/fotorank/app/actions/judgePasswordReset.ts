"use server";

/**
 * "Olvidé mi contraseña" para un jurado.
 *
 * El jurado tiene su propia identidad, separada de `User`, así que el
 * `/recuperar` del sitio no lo encuentra: le respondía el mensaje neutro de
 * siempre y no le llegaba nada. Esta es su puerta.
 */
import { redirect } from "next/navigation";

import { prisma } from "@repo/db";

import { createJudgeSessionForJudge, revokeAllJudgeSessionsForJudge } from "../lib/judge-auth";
import { hashPassword } from "../lib/security/password";
import { enqueueTransactionalEmail } from "../lib/fotorank/notifications/outbox";
import {
  crearTokenDeVerificacion,
  hashDeToken,
  revisarToken,
} from "../lib/fotorank/judges/judgeEmailVerification";
import {
  COMO_PEDIR_OTRO,
  puedeRecibirEnlaceDeReset,
  RESET_VIGENCIA_HORAS,
  RESPUESTA_NEUTRA,
  revisarNuevaClave,
  type ErroresDeNuevaClave,
} from "../lib/fotorank/judges/judgePasswordReset";

function baseUrl(): string {
  const raw =
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_FOTORANK_URL?.trim() ||
    "";
  return raw ? raw.replace(/\/+$/, "") : "http://localhost:3000";
}

function texto(fd: FormData, campo: string): string {
  const v = fd.get(campo);
  return typeof v === "string" ? v : "";
}

export type EstadoDelPedido = { info: string | null; error: string | null };

/**
 * Paso 1: pedir el enlace.
 *
 * Responde siempre lo mismo, exista la cuenta o no. Decir "no encontramos ese
 * correo" dejaría averiguar quién es jurado en la plataforma probando
 * direcciones.
 */
export async function pedirEnlaceDeResetAction(
  _prev: EstadoDelPedido | undefined,
  formData: FormData,
): Promise<EstadoDelPedido> {
  const email = texto(formData, "email").trim().toLowerCase();
  if (!email) return { info: null, error: "Escribí tu correo." };

  const cuenta = await prisma.fotorankJudgeAccount.findUnique({
    where: { email },
    select: { accountStatus: true, profile: { select: { firstName: true } } },
  });

  if (puedeRecibirEnlaceDeReset(cuenta)) {
    const ahora = new Date();
    const enlace = crearTokenDeVerificacion(ahora, RESET_VIGENCIA_HORAS);

    /*
     * Los pedidos anteriores se invalidan.
     *
     * Si no, alguien que pidió tres enlaces deja tres llaves vivas, y basta
     * con que una sola quede a la vista para entrar.
     */
    await prisma.emailVerificationToken.updateMany({
      where: { email, purpose: "PASSWORD_RESET", usedAt: null },
      data: { usedAt: ahora },
    });

    await prisma.emailVerificationToken.create({
      data: {
        email,
        token: enlace.tokenHash,
        purpose: "PASSWORD_RESET",
        expiresAt: enlace.expiresAt,
      },
    });

    await enqueueTransactionalEmail({
      kind: "JUDGE_PASSWORD_RESET",
      toEmail: email,
      payload: {
        firstName: cuenta?.profile?.firstName ?? "",
        resetUrl: `${baseUrl()}/jurado/recuperar/${enlace.token}`,
        horas: RESET_VIGENCIA_HORAS,
      },
    });
  }

  return { info: RESPUESTA_NEUTRA, error: null };
}

export type EstadoDeLaNuevaClave = {
  error: string | null;
  errores?: ErroresDeNuevaClave;
};

/**
 * Paso 2: cambiar la contraseña con el enlace.
 *
 * Al terminar cierra todas las sesiones abiertas de ese jurado y le abre una
 * nueva. Quien recupera su contraseña suele hacerlo porque sospecha que
 * alguien más entró: dejar viva la sesión de esa persona vaciaría el gesto.
 */
export async function cambiarClaveConEnlaceAction(
  _prev: EstadoDeLaNuevaClave | undefined,
  formData: FormData,
): Promise<EstadoDeLaNuevaClave> {
  const token = texto(formData, "token").trim();
  const password = texto(formData, "password");
  const passwordConfirm = texto(formData, "passwordConfirm");

  const clave = revisarNuevaClave({ password, passwordConfirm });
  if (!clave.ok) {
    return { error: "Revisá los datos marcados.", errores: clave.errores };
  }

  const ahora = new Date();
  const fila = await prisma.emailVerificationToken.findUnique({
    where: { token: hashDeToken(token) },
    select: { id: true, email: true, usedAt: true, expiresAt: true, purpose: true },
  });

  const revision = revisarToken({
    fila: fila
      ? { usedAt: fila.usedAt, expiresAt: fila.expiresAt, purpose: fila.purpose }
      : null,
    ahora,
    esperado: "PASSWORD_RESET",
    comoPedirOtro: COMO_PEDIR_OTRO,
  });
  if (!revision.ok) return { error: revision.mensaje };

  const cuenta = await prisma.fotorankJudgeAccount.findUnique({
    where: { email: fila!.email },
    select: { id: true, accountStatus: true },
  });

  // El estado se vuelve a mirar acá: entre el pedido y el uso del enlace la
  // cuenta pudo ser suspendida.
  if (!puedeRecibirEnlaceDeReset(cuenta)) {
    return { error: `Este enlace ya no sirve. ${COMO_PEDIR_OTRO}` };
  }

  const passwordHash = await hashPassword(password);

  await prisma.$transaction([
    prisma.emailVerificationToken.update({
      where: { id: fila!.id },
      data: { usedAt: ahora },
    }),
    prisma.fotorankJudgeAccount.update({
      where: { id: cuenta!.id },
      data: { passwordHash },
    }),
  ]);

  await revokeAllJudgeSessionsForJudge(cuenta!.id);
  await createJudgeSessionForJudge(cuenta!.id);

  redirect("/jurado/panel");
}
