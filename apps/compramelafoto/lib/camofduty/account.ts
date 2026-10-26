/**
 * Cuenta de fotógrafo de Cam Of Duty (en la base de CompraMeLaFoto): código de
 * 6 dígitos para validar el email y datos del perfil.
 */

import { sendEmail } from "@/emails/send";
import { prisma } from "@/lib/prisma";
import { accountBornInCamOfDuty } from "@/lib/simulator/cam-of-duty-visits";
import {
  EMAIL_CODE_MAX_ATTEMPTS,
  EMAIL_CODE_RESEND_MS,
  EMAIL_CODE_TTL_MS,
  generateEmailCode,
  hashEmailCode,
  type CleanProfile,
} from "./photographer-profile";

export type SendCodeResult = { ok: true } | { ok: false; error: string; status: number };

/** Manda un código nuevo (los anteriores dejan de servir). */
export async function sendEmailCode(email: string, firstName?: string | null): Promise<SendCodeResult> {
  const last = await prisma.camOfDutyEmailCode.findFirst({ where: { email }, orderBy: { createdAt: "desc" } });
  if (last && Date.now() - last.createdAt.getTime() < EMAIL_CODE_RESEND_MS) {
    return { ok: false, error: "Ya te mandamos un código hace un momento. Esperá un minuto para pedir otro.", status: 429 };
  }
  const code = generateEmailCode();
  await prisma.camOfDutyEmailCode.updateMany({ where: { email, usedAt: null }, data: { usedAt: new Date() } });
  await prisma.camOfDutyEmailCode.create({
    data: { email, codeHash: hashEmailCode(email, code), expiresAt: new Date(Date.now() + EMAIL_CODE_TTL_MS) },
  });
  if (process.env.NODE_ENV === "development") console.info(`[camofduty] código para ${email}: ${code}`);
  try {
    await sendEmail({
      to: email,
      subject: `Tu código de Cam Of Duty: ${code}`,
      html: `
        <p>${firstName ? `Hola ${firstName},` : "Hola,"}</p>
        <p>Este es tu código para validar el email y entrar a Cam Of Duty:</p>
        <p style="font-size: 32px; letter-spacing: 8px; font-weight: 700; margin: 18px 0;">${code}</p>
        <p>Vence en 15 minutos.</p>
        <p style="font-size: 13px; color: #6b7280;">Cam Of Duty usa tu cuenta de fotógrafo de CompraMeLaFoto. Si no fuiste vos, ignorá este mensaje.</p>
      `,
      templateKey: "AUTH01_VERIFY_EMAIL",
    });
  } catch (error) {
    console.error("[camofduty] no se pudo mandar el código", { email, error });
    if (process.env.NODE_ENV !== "development") {
      return { ok: false, error: "No pudimos mandar el email. Probá de nuevo en un rato.", status: 502 };
    }
  }
  return { ok: true };
}

export type VerifyCodeResult = { ok: true } | { ok: false; error: string; status: number };

/** Compara el código con el último enviado; si está bien, el email queda validado. */
export async function verifyEmailCode(userId: number, email: string, code: string): Promise<VerifyCodeResult> {
  const row = await prisma.camOfDutyEmailCode.findFirst({
    where: { email, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return { ok: false, error: "El código venció. Pedí uno nuevo.", status: 410 };
  if (row.attempts >= EMAIL_CODE_MAX_ATTEMPTS) {
    return { ok: false, error: "Probaste demasiadas veces. Pedí un código nuevo.", status: 429 };
  }
  if (row.codeHash !== hashEmailCode(email, code)) {
    await prisma.camOfDutyEmailCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    const left = EMAIL_CODE_MAX_ATTEMPTS - row.attempts - 1;
    return { ok: false, error: left > 0 ? `El código no es correcto. Te quedan ${left} intentos.` : "El código no es correcto. Pedí uno nuevo.", status: 400 };
  }
  const now = new Date();
  await prisma.$transaction([
    prisma.camOfDutyEmailCode.update({ where: { id: row.id }, data: { usedAt: now } }),
    prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: now } }),
  ]);
  return { ok: true };
}

/** Guarda los datos del fotógrafo en su cuenta de CLF y el aviso de trabajos en Cam Of Duty. */
export async function saveCamOfDutyProfile(userId: number, profile: CleanProfile, ip: string): Promise<void> {
  const now = new Date();
  const previous = await prisma.camOfDutyMember.findUnique({ where: { userId }, select: { jobAlertsOptIn: true } });
  const alertsChanged = previous?.jobAlertsOptIn !== profile.jobAlerts;
  const alerts = profile.jobAlerts
    ? { jobAlertsOptIn: true, ...(alertsChanged ? { jobAlertsOptInAt: now, jobAlertsOptInIp: ip } : {}) }
    : { jobAlertsOptIn: false, jobAlertsOptInAt: null, jobAlertsOptInIp: null };
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        name: `${profile.firstName} ${profile.lastName}`,
        whatsapp: profile.whatsapp,
        instagram: profile.instagram,
        companyName: profile.company,
        city: profile.city,
        province: profile.province,
        country: profile.country,
        latitude: profile.latitude,
        longitude: profile.longitude,
      },
    }),
    prisma.camOfDutyMember.upsert({
      where: { userId },
      // Primera vez en Cam Of Duty: si la cuenta es recién creada, nació acá.
      create: { userId, firstVisitAt: now, lastVisitAt: now, visits: 0, profileCompletedAt: now, accountFromCamOfDuty: await bornHere(userId, now), ...alerts },
      update: { profileCompletedAt: now, ...alerts },
    }),
  ]);
}

/** ¿La cuenta se creó para entrar a Cam Of Duty? */
async function bornHere(userId: number, now: Date): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
  return user ? accountBornInCamOfDuty(user.createdAt, now) : false;
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}
