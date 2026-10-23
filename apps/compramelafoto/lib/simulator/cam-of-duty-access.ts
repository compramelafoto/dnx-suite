/**
 * Entrada a Cam Of Duty: es de uso libre, pero el simulador y el estudio de luz
 * piden cuenta de CompraMeLaFoto. Quien entra queda registrado en
 * `CamOfDutyMember`, así los usuarios de Cam Of Duty son usuarios de CLF.
 */

import { redirect } from "next/navigation";
import { getAuthUser, type AuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { camOfDutySignupUrl, isNewVisit } from "./cam-of-duty-visits";

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
      data: { lastVisitAt: now, ...(isNewVisit(member.lastVisitAt, now) ? { visits: { increment: 1 } } : {}) },
    });
  } catch (error) {
    console.error("[camofduty] no se pudo anotar la entrada", { userId, error });
  }
}

/** Para las páginas de Cam Of Duty: sin sesión manda a registrarse; con sesión anota la entrada. */
export async function requireCamOfDutyUser(path: string): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) redirect(camOfDutySignupUrl(path));
  await recordCamOfDutyVisit(user.id);
  return user;
}
