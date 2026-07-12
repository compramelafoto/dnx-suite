import { prisma } from "./prisma";
import { createOpaqueToken, hashOpaqueToken, hashPassword } from "./password";
import { revokeAllUserSessions } from "./sessions";
import {
  passwordResetEmailContent,
  sendIdentityEmail,
  type IdentityEmailResult,
} from "./email";

export const DNX_PASSWORD_RESET_TTL_MS = 1000 * 60 * 60; // 1 hora

/**
 * Crea token de reset de un solo uso.
 * Siempre responde de forma genérica a nivel de UI (no revelar si el email existe).
 */
export async function requestPasswordReset(params: {
  email: string;
  appBaseUrl: string;
  appLabel?: string;
  resetPath?: string;
}): Promise<{ ok: true; emailResult?: IdentityEmailResult; created: boolean }> {
  const email = params.email.trim().toLowerCase();
  if (!email) return { ok: true, created: false };

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, isBlocked: true, password: true },
  });

  if (!user || user.isBlocked || !user.password) {
    return { ok: true, created: false };
  }

  const { rawToken, tokenHash } = createOpaqueToken();
  const expiresAt = new Date(Date.now() + DNX_PASSWORD_RESET_TTL_MS);

  await (prisma as typeof prisma & {
    passwordResetToken: {
      create(args: unknown): Promise<unknown>;
    };
  }).passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  const resetUrl = `${params.appBaseUrl.replace(/\/$/, "")}${params.resetPath ?? "/recuperar"}/${rawToken}`;
  const content = passwordResetEmailContent({
    resetUrl,
    appLabel: params.appLabel,
  });
  const emailResult = await sendIdentityEmail({
    to: email,
    subject: content.subject,
    html: content.html,
    text: content.text,
    templateKey: "dnx.identity.password_reset",
  });

  return { ok: true, created: true, emailResult };
}

export async function resetPasswordWithToken(params: {
  rawToken: string;
  newPassword: string;
}): Promise<{ userId: number }> {
  if (params.newPassword.length < 8) {
    throw new Error("La contraseña debe tener al menos 8 caracteres.");
  }

  const tokenHash = hashOpaqueToken(params.rawToken);
  const row = (await (prisma as typeof prisma & {
    passwordResetToken: {
      findUnique(args: unknown): Promise<{
        id: number;
        userId: number;
        expiresAt: Date;
        usedAt: Date | null;
      } | null>;
      update(args: unknown): Promise<unknown>;
    };
  }).passwordResetToken.findUnique({
    where: { tokenHash },
  })) as {
    id: number;
    userId: number;
    expiresAt: Date;
    usedAt: Date | null;
  } | null;

  if (!row || row.usedAt || row.expiresAt.getTime() <= Date.now()) {
    throw new Error("El enlace de recuperación es inválido o venció.");
  }

  const passwordHash = hashPassword(params.newPassword);
  await prisma.user.update({
    where: { id: row.userId },
    data: { password: passwordHash },
  });

  await (prisma as typeof prisma & {
    passwordResetToken: { update(args: unknown): Promise<unknown> };
  }).passwordResetToken.update({
    where: { id: row.id },
    data: { usedAt: new Date() },
  });

  await revokeAllUserSessions(row.userId);
  return { userId: row.userId };
}
