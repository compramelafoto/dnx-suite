import { cache } from "react";
import { redirect } from "next/navigation";
import { sanitizeReturnTo } from "@repo/auth";
import { getCurrentUser, type CurrentUser } from "@repo/auth-guards";
import { prisma } from "@repo/db";
import { computeLevel, type VerificationLevel } from "@/lib/identidad/nivel";

/**
 * Puerta de entrada del portal: quién es la persona y hasta qué paso de verificación llegó.
 * Orden de los niveles: sin_correo < registrado < telefono < identidad.
 */

export type PortalLevel = VerificationLevel | "sin_correo";

const ORDEN: Record<PortalLevel, number> = {
  sin_correo: 0,
  registrado: 1,
  telefono: 2,
  identidad: 3,
};

export type PortalIdentity = {
  status: "PENDING" | "IN_REVIEW" | "APPROVED" | "REJECTED";
  reverifyRequiredAt: Date | null;
  legalName: string | null;
  reviewedById: number | null;
  rejectionReason: string | null;
};

export type PortalUser = CurrentUser & {
  level: PortalLevel;
  /** Con identidad aprobada es el nombre legal del DNI (no se edita); si no, el de la cuenta. */
  displayName: string | null;
  phone: string | null;
  phoneVerifiedAt: Date | null;
  emailVerifiedAt: Date | null;
  identity: PortalIdentity | null;
  /** Bloqueo del portal sin levantar (`PortalAccountBlock`). Nunca se mira `User.isBlocked` de CLF. */
  blocked: boolean;
};

/**
 * Memoizada por pedido (`React.cache`): el layout, `requireLevel` y la página comparten un solo
 * resultado en vez de repetir la sesión y las tres consultas.
 */
export const getPortalUser = cache(cargarPortalUser);

async function cargarPortalUser(): Promise<PortalUser | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const [dbUser, phone, identity, bloqueo] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { emailVerifiedAt: true } }),
    prisma.phoneVerification.findUnique({
      where: { userId: user.id },
      select: { verifiedAt: true, phone: true },
    }),
    prisma.identityVerification.findUnique({
      where: { userId: user.id },
      select: {
        status: true,
        reverifyRequiredAt: true,
        legalName: true,
        reviewedById: true,
        rejectionReason: true,
      },
    }),
    prisma.portalAccountBlock.findUnique({ where: { userId: user.id }, select: { liftedAt: true } }),
  ]);

  const level = computeLevel({
    emailVerifiedAt: dbUser?.emailVerifiedAt ?? null,
    phoneVerifiedAt: phone?.verifiedAt ?? null,
    identity: identity ?? null,
  });

  // Mismo criterio de «aprobada» que computeLevel: el nombre legal manda sólo si la identidad
  // está aprobada (aunque haya que reverificar el teléfono, el nombre del DNI sigue siendo ése).
  const nombreLegal =
    identity?.status === "APPROVED" && identity.legalName?.trim() ? identity.legalName.trim() : null;

  return {
    ...user,
    level,
    displayName: nombreLegal ?? user.name,
    phone: phone?.phone ?? null,
    phoneVerifiedAt: phone?.verifiedAt ?? null,
    emailVerifiedAt: dbUser?.emailVerifiedAt ?? null,
    identity: identity ?? null,
    blocked: bloqueo != null && bloqueo.liftedAt == null,
  };
}

/**
 * Exige sesión y un nivel mínimo. Sin sesión va a /login (con returnTo); con la cuenta bloqueada
 * va a /cuenta/bloqueada (esa página no usa `requireLevel`, así no hay vuelta en redondo); con un
 * nivel menor va a «Mi verificación», que muestra el paso que falta.
 */
export async function requireLevel(
  minimo: VerificationLevel,
  returnTo?: string,
): Promise<PortalUser> {
  const user = await getPortalUser();
  if (!user) {
    redirect(`/login?returnTo=${encodeURIComponent(sanitizeReturnTo(returnTo, { fallback: "/" }))}`);
  }
  if (user.blocked) redirect("/cuenta/bloqueada");
  if (ORDEN[user.level] < ORDEN[minimo]) redirect("/cuenta/verificacion");
  return user;
}
