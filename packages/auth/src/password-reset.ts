import { prisma } from "./prisma";
import { createOpaqueToken, hashOpaqueToken, hashPassword } from "./password";
import { revokeAllUserSessions } from "./sessions";
import { requireNormalizedIdentityEmail } from "./identity-email";
import { requirePasswordPolicy } from "./password-policy";
import { DNX_AUTH_MESSAGES } from "./messages";
import {
  passwordResetEmailContent,
  sendIdentityEmail,
  type IdentityEmailResult,
} from "./email";

export const DNX_PASSWORD_RESET_TTL_MS = 1000 * 60 * 60; // 1 hora

/**
 * Crea token de reset de un solo uso.
 * Permite Google-only (sin password) para “crear contraseña”.
 * Siempre responde de forma genérica a nivel de UI (anti-enumeración).
 */
export async function requestPasswordReset(params: {
  email: string;
  appBaseUrl: string;
  appLabel?: string;
  resetPath?: string;
}): Promise<{ ok: true; emailResult?: IdentityEmailResult; created: boolean }> {
  let email: string;
  try {
    email = requireNormalizedIdentityEmail(params.email);
  } catch {
    return { ok: true, created: false };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, isBlocked: true, password: true },
  });

  if (!user || user.isBlocked) {
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
    isSetPassword: !user.password,
  });
  const emailResult = await sendIdentityEmail({
    to: email,
    subject: content.subject,
    html: content.html,
    text: content.text,
    templateKey: user.password
      ? "dnx.identity.password_reset"
      : "dnx.identity.password_set",
  });

  console.info("[dnx.identity] passwordReset.requested", {
    userId: user.id,
    setPassword: !user.password,
    emailSent: emailResult.sent,
  });

  return { ok: true, created: true, emailResult };
}

export async function resetPasswordWithToken(params: {
  rawToken: string;
  newPassword: string;
  passwordConfirm?: string;
  /** Default true — revoca todas las sesiones. */
  revokeSessions?: boolean;
}): Promise<{ userId: number }> {
  requirePasswordPolicy(params.newPassword, {
    confirm: params.passwordConfirm,
  });

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
    throw new Error(DNX_AUTH_MESSAGES.resetInvalidToken);
  }

  const passwordHash = hashPassword(params.newPassword);
  await prisma.user.update({
    where: { id: row.userId },
    data: {
      password: passwordHash,
      // Limpiar tokens legacy en User si existen
      passwordResetToken: null,
      passwordResetExpires: null,
    },
  });

  await (prisma as typeof prisma & {
    passwordResetToken: { update(args: unknown): Promise<unknown> };
  }).passwordResetToken.update({
    where: { id: row.id },
    data: { usedAt: new Date() },
  });

  if (params.revokeSessions !== false) {
    await revokeAllUserSessions(row.userId);
  }

  console.info("[dnx.identity] passwordReset.consumed", { userId: row.userId });
  return { userId: row.userId };
}

/** Mensaje neutro para UI. */
export function passwordResetNeutralMessage(): string {
  return DNX_AUTH_MESSAGES.resetNeutral;
}
