/**
 * Cambio / creación de contraseña en cuenta existente (perfil).
 */

import { prisma } from "./prisma";
import { hashPassword, verifyPassword } from "./password";
import { requirePasswordPolicy } from "./password-policy";
import { revokeAllUserSessions } from "./sessions";
import { DNX_AUTH_MESSAGES } from "./messages";
import {
  passwordChangedEmailContent,
  sendIdentityEmail,
} from "./email";

export async function changeUserPassword(params: {
  userId: number;
  currentPassword?: string;
  newPassword: string;
  passwordConfirm?: string;
  /** Si no hay password actual (Google-only), exigir que currentPassword esté vacío y allowCreate. */
  allowCreateWithoutCurrent?: boolean;
  revokeOtherSessions?: boolean;
  appLabel?: string;
  notifyEmail?: boolean;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  requirePasswordPolicy(params.newPassword, {
    confirm: params.passwordConfirm,
  });

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: {
      id: true,
      email: true,
      name: true,
      password: true,
      isBlocked: true,
    },
  });
  if (!user || user.isBlocked) {
    return { ok: false, message: DNX_AUTH_MESSAGES.accountBlocked };
  }

  if (user.password) {
    if (!params.currentPassword || !verifyPassword(params.currentPassword, user.password)) {
      return { ok: false, message: "La contraseña actual es incorrecta." };
    }
  } else if (!params.allowCreateWithoutCurrent) {
    return {
      ok: false,
      message:
        "Tu cuenta no tiene contraseña. Usá «Olvidé mi contraseña» para crear una, o vinculá Google.",
    };
  }

  const nextHash = hashPassword(params.newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: nextHash },
  });

  if (params.revokeOtherSessions) {
    await revokeAllUserSessions(user.id);
  }

  if (params.notifyEmail !== false) {
    const content = passwordChangedEmailContent({
      appLabel: params.appLabel,
      firstName: user.name,
    });
    await sendIdentityEmail({
      to: user.email,
      subject: content.subject,
      html: content.html,
      text: content.text,
      templateKey: "dnx.identity.password_changed",
    });
  }

  console.info("[dnx.identity] password.changed", {
    userId: user.id,
    created: !user.password,
  });
  return { ok: true };
}
