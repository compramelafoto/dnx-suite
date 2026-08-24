"use server";

import { prisma } from "@repo/db";
import { requestPasswordReset } from "@repo/auth";
import { findInvitationByTokenHash } from "@repo/db/fotoffice-member-invitations";
import { hashInvitationToken } from "@/lib/members/invitation-tokens";
import { canMemberUseInvitations, invitationState } from "@/lib/members/invitations";
import {
  clearInvitationContinuity,
  setInvitationContinuity,
} from "@/lib/members/invitation-continuity";

export type ActivationStatus =
  | "IDLE"
  | "PASSWORD_EMAIL_SENT"
  | "SIGN_IN_REQUIRED"
  | "INVALID"
  | "CONFIGURATION_ERROR"
  | "SEND_FAILED";

export type ActivationState = { status: ActivationStatus; message: string };

const MESSAGES: Record<Exclude<ActivationStatus, "IDLE">, string> = {
  PASSWORD_EMAIL_SENT:
    "Te enviamos un email para que crees tu contraseña. Cuando la tengas, iniciá sesión y volvés acá para terminar.",
  SIGN_IN_REQUIRED: "Ya tenés una cuenta con este email. Iniciá sesión para continuar.",
  INVALID: "Este enlace no es válido o ya fue utilizado. Pedile a la institución que te envíe uno nuevo.",
  CONFIGURATION_ERROR:
    "No pudimos continuar por una falta de configuración del sistema. Avisale a la institución.",
  SEND_FAILED: "No pudimos enviarte el email. Intentá de nuevo en unos minutos.",
};

function fail(status: Exclude<ActivationStatus, "IDLE" | "PASSWORD_EMAIL_SENT">): ActivationState {
  return { status, message: MESSAGES[status] };
}

/**
 * Primer paso de la activación con contraseña, para un socio que todavía no tiene cuenta.
 *
 * Crea el `User` —sin contraseña, sin sesión, sin membresía— y dispara el email de "crear
 * contraseña" del sistema de identidad que ya existe. NO vincula el socio: la vinculación
 * ocurre después, con sesión autenticada y confirmación explícita. Si la persona abandona el
 * proceso acá, queda una cuenta sin contraseña que no puede iniciar sesión por sí sola y un
 * socio sin vincular — ningún acceso otorgado a nadie.
 *
 * Todo se revalida en servidor desde el token: nada de lo que mande el navegador se cree.
 */
export async function startPasswordActivationAction(
  _prev: ActivationState | undefined,
  formData: FormData,
): Promise<ActivationState> {
  const rawToken = formData.get("token")?.toString()?.trim();
  if (!rawToken) return fail("INVALID");

  const invitation = await findInvitationByTokenHash(hashInvitationToken(rawToken));
  if (
    !invitation ||
    invitationState(invitation) !== "PENDING" ||
    invitation.member.userId !== null ||
    !canMemberUseInvitations(invitation.member.status)
  ) {
    // Una continuidad guardada para un enlace que ya no sirve solo estorba.
    await clearInvitationContinuity();
    return fail("INVALID");
  }

  // El email sale de la fila de la invitación, ya normalizado al crearla.
  const email = invitation.email;

  // Sin base absoluta el email de contraseña llevaría a ninguna parte: no se crea nada.
  const appBaseUrl = process.env.APP_URL?.trim();
  if (!appBaseUrl || !/^https?:\/\//.test(appBaseUrl)) return fail("CONFIGURATION_ERROR");

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, password: true },
  });
  // Con contraseña ya puesta no se toca nada: que inicie sesión y vuelva.
  if (existing?.password) return fail("SIGN_IN_REQUIRED");

  if (!existing) {
    // `upsert` y no `create`: dos clics simultáneos no pueden producir dos cuentas.
    // Sin contraseña no hay login posible, `globalRole` queda en USER y no se crea
    // ninguna membresía de workspace: la cuenta no otorga acceso a nada todavía.
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, role: "CUSTOMER" },
    });
  }

  // La continuidad se guarda ANTES de mandar el email: si se guardara después y el envío
  // fallara, la persona podría recibirlo igual y volver sin continuidad.
  await setInvitationContinuity(rawToken, invitation.expiresAt);

  const reset = await requestPasswordReset({
    email,
    appBaseUrl,
    appLabel: "FotoOffice",
    resetPath: "/recuperar",
  });

  // `requestPasswordReset` devuelve `ok: true` incluso cuando NO mandó nada: es su respuesta
  // neutra anti-enumeración. El único dato confiable es `emailResult`, y su AUSENCIA también
  // significa que no salió (cuenta bloqueada, por ejemplo). Sin este control, la pantalla
  // diría "te enviamos un email" sin que exista tal email.
  if (!reset.emailResult) return fail("SEND_FAILED");
  if (!reset.emailResult.sent) {
    // `skipped` marca falta de configuración; el resto es rechazo del proveedor o red caída.
    // El `reason` NO se propaga: puede traer hasta 120 caracteres del cuerpo crudo de Resend.
    return fail(reset.emailResult.skipped ? "CONFIGURATION_ERROR" : "SEND_FAILED");
  }

  return { status: "PASSWORD_EMAIL_SENT", message: MESSAGES.PASSWORD_EMAIL_SENT };
}
