/**
 * Entrada a Cam Of Duty: es de uso libre, pero el simulador y el Estudio Fotográfico
 * piden cuenta de fotógrafo de CompraMeLaFoto con el email validado y los
 * datos completos. Quien entra queda registrado en `CamOfDutyMember`, así los
 * usuarios de Cam Of Duty son fotógrafos de CLF.
 */

import { redirect } from "next/navigation";
import { getAuthUser, type AuthUser } from "@/lib/auth";
import { isProfileComplete } from "@/lib/camofduty/photographer-profile";
import { prisma } from "@/lib/prisma";
import { camOfDutyAccessUrl, camOfDutyGate, camOfDutySignupUrl, isNewVisit } from "./cam-of-duty-visits";

/** Anota la entrada. Nunca corta el paso: si la base falla, se usa igual. */
export async function recordCamOfDutyVisit(userId: number, now = new Date()): Promise<void> {
  try {
    const member = await prisma.camOfDutyMember.findUnique({ where: { userId } });
    if (!member) {
      await prisma.camOfDutyMember.create({ data: { userId, firstVisitAt: now, lastVisitAt: now } });
      return;
    }
    await prisma.camOfDutyMember.update({
      where: { userId },
      // La primera entrada siempre cuenta (la fila puede haberse creado recién, al registrarse).
      data: { lastVisitAt: now, ...(member.visits === 0 || isNewVisit(member.lastVisitAt, now) ? { visits: { increment: 1 } } : {}) },
    });
  } catch (error) {
    console.error("[camofduty] no se pudo anotar la entrada", { userId, error });
  }
}

/** Datos de la cuenta que deciden si puede entrar. */
export async function loadCamOfDutyAccount(userId: number) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      globalRole: true,
      emailVerifiedAt: true,
      whatsapp: true,
      instagram: true,
      companyName: true,
      city: true,
      province: true,
      country: true,
      latitude: true,
      longitude: true,
      camOfDutyMember: { select: { jobAlertsOptIn: true } },
    },
  });
}

/**
 * Para las páginas de Cam Of Duty: sin sesión, a ingresar; sin email validado,
 * a poner el código; con datos incompletos, a completarlos. Si está todo, anota la entrada.
 */
export async function requireCamOfDutyUser(path: string): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) redirect(camOfDutySignupUrl(path));
  const account = await loadCamOfDutyAccount(user.id);
  if (!account) redirect(camOfDutySignupUrl(path));
  const gate = camOfDutyGate({
    role: account.role,
    globalRole: account.globalRole,
    emailVerifiedAt: account.emailVerifiedAt,
    profileComplete: isProfileComplete(account),
  });
  if (gate === "not-photographer") redirect(`${camOfDutySignupUrl(path)}&cuenta=no-fotografo`);
  if (gate === "verify") redirect(camOfDutyAccessUrl("verify", path));
  if (gate === "complete") redirect(camOfDutyAccessUrl("complete", path));
  await recordCamOfDutyVisit(user.id);
  return user;
}
