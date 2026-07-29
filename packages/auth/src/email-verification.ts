/**
 * Verificación de email central DNX.
 * Usa `EmailVerificationToken` (token hasheado SHA-256).
 */

import { prisma } from "./prisma";
import { createOpaqueToken, hashOpaqueToken } from "./password";
import { requireNormalizedIdentityEmail } from "./identity-email";
import {
  sendIdentityEmail,
  type IdentityEmailResult,
} from "./email";
import type { DnxApplicationId } from "./identity";

export const DNX_EMAIL_VERIFY_TTL_MS = 1000 * 60 * 60 * 24; // 24h

function emailVerificationContent(params: {
  verifyUrl: string;
  appLabel?: string;
}): { subject: string; html: string; text: string } {
  const app = params.appLabel?.trim() || "DNX Suite";
  const subject = `Verificá tu email — Cuenta DNX`;
  const text = [
    `Creaste o actualizaste tu Cuenta DNX desde ${app}.`,
    `Esta misma cuenta puede utilizarse en otras plataformas DNX habilitadas.`,
    ``,
    `Verificá tu email:`,
    params.verifyUrl,
    ``,
    `Si no creaste esta cuenta, ignorá el mensaje.`,
  ].join("\n");
  const html = `
    <p>Creaste o actualizaste tu <strong>Cuenta DNX</strong> desde <strong>${escapeHtml(app)}</strong>.</p>
    <p>Esta misma cuenta puede utilizarse en otras plataformas DNX habilitadas (cuando tengas acceso).</p>
    <p><a href="${escapeHtml(params.verifyUrl)}">Verificar email</a></p>
    <p style="color:#666;font-size:14px">Si no creaste esta cuenta, ignorá el mensaje.</p>
  `.trim();
  return { subject, html, text };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type EmailVerificationDelegate = {
  create(args: unknown): Promise<unknown>;
  updateMany(args: unknown): Promise<{ count: number }>;
  findFirst(args: unknown): Promise<{
    id: number;
    email: string;
    expiresAt: Date;
    usedAt: Date | null;
  } | null>;
  update(args: unknown): Promise<unknown>;
};

function tokens(): EmailVerificationDelegate {
  return (prisma as unknown as { emailVerificationToken: EmailVerificationDelegate })
    .emailVerificationToken;
}

/**
 * Emite token de verificación (invalida pendientes previos del mismo email+purpose).
 * Respuesta anti-enumeración a nivel de UI: siempre ok.
 */
export async function requestEmailVerification(params: {
  email: string;
  appBaseUrl: string;
  appLabel?: string;
  verifyPath?: string;
  sourceApplication: DnxApplicationId;
}): Promise<{ ok: true; created: boolean; emailResult?: IdentityEmailResult }> {
  const email = requireNormalizedIdentityEmail(params.email);
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, isBlocked: true, emailVerifiedAt: true },
  });

  if (!user || user.isBlocked || user.emailVerifiedAt) {
    return { ok: true, created: false };
  }

  const { rawToken, tokenHash } = createOpaqueToken();
  const expiresAt = new Date(Date.now() + DNX_EMAIL_VERIFY_TTL_MS);

  await tokens().updateMany({
    where: {
      email,
      purpose: "VERIFY_EMAIL",
      usedAt: null,
    },
    data: { usedAt: new Date() },
  });

  await tokens().create({
    data: {
      email,
      token: tokenHash,
      purpose: "VERIFY_EMAIL",
      expiresAt,
    },
  });

  const verifyUrl = `${params.appBaseUrl.replace(/\/$/, "")}${params.verifyPath ?? "/verificar-email"}?token=${rawToken}`;
  const content = emailVerificationContent({
    verifyUrl,
    appLabel: params.appLabel,
  });
  const emailResult = await sendIdentityEmail({
    to: email,
    subject: content.subject,
    html: content.html,
    text: content.text,
    templateKey: "dnx.identity.email_verify",
  });

  console.info("[dnx.identity] emailVerification.requested", {
    userId: user.id,
    source: params.sourceApplication,
    emailSent: emailResult.sent,
  });

  return { ok: true, created: true, emailResult };
}

export async function verifyEmailWithToken(params: {
  rawToken: string;
}): Promise<{ userId: number; email: string }> {
  const tokenHash = hashOpaqueToken(params.rawToken);
  const row = await tokens().findFirst({
    where: {
      token: tokenHash,
      purpose: "VERIFY_EMAIL",
    },
  });

  if (!row || row.usedAt || row.expiresAt.getTime() <= Date.now()) {
    throw new Error("El enlace de verificación es inválido o venció.");
  }

  const email = requireNormalizedIdentityEmail(row.email);
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, isBlocked: true },
  });
  if (!user || user.isBlocked) {
    throw new Error("El enlace de verificación es inválido o venció.");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerifiedAt: new Date() },
  });
  await tokens().update({
    where: { id: row.id },
    data: { usedAt: new Date() },
  });

  console.info("[dnx.identity] emailVerification.consumed", { userId: user.id });
  return { userId: user.id, email };
}
