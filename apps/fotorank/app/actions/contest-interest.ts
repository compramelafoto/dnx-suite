"use server";

/**
 * Server actions del botón "Notificarme".
 *
 * Seguridad:
 *   - Sesión obligatoria: el interés se registra contra un usuario, nunca contra un email suelto.
 *   - Toda validación es del lado servidor; el cliente sólo aporta las casillas de consentimiento.
 *   - CSRF: Next.js valida el origen de las server actions.
 *   - Rate limiting por usuario, además de la restricción única en la base.
 */

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { getAuthUser } from "../lib/auth";
import { routes } from "../lib/routes";
import {
  INTEREST_RATE_LIMIT,
  hashRateLimitSubject,
  interestRateLimitStore,
} from "../lib/fotorank/upcoming/rate-limit";
import {
  cancelInterest,
  getInterestForUser,
  registerInterest,
} from "../lib/fotorank/upcoming/service";

export type InterestActionResult =
  | { ok: true; message: string; benefitEligible: boolean }
  | { ok: false; error: string; requiresLogin?: boolean };

async function requestContext(): Promise<{ ip: string | null; userAgent: string | null }> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return {
    ip: forwarded ? forwarded.split(",")[0]!.trim() : null,
    userAgent: h.get("user-agent"),
  };
}

/**
 * Registra el interés del usuario autenticado.
 *
 * El consentimiento específico llega del formulario y es obligatorio: sin él la
 * acción se rechaza. El consentimiento general es opcional e independiente.
 */
export async function registerContestInterestAction(input: {
  contestId: string;
  slug: string;
  contestSpecificOptIn: boolean;
  generalOptIn: boolean;
  source?: string;
  utm?: { source?: string | null; medium?: string | null; campaign?: string | null };
}): Promise<InterestActionResult> {
  const user = await getAuthUser();
  if (!user) {
    return {
      ok: false,
      requiresLogin: true,
      error: "Iniciá sesión o creá tu cuenta para que podamos avisarte.",
    };
  }

  const rl = await interestRateLimitStore.consume(
    hashRateLimitSubject(`interest:${user.id}`),
    INTEREST_RATE_LIMIT.limit,
    INTEREST_RATE_LIMIT.windowMs,
  );
  if (!rl.allowed) {
    return { ok: false, error: "Demasiados intentos seguidos. Probá de nuevo en un minuto." };
  }

  const ctx = await requestContext();
  const result = await registerInterest({
    contestId: input.contestId,
    userId: user.id,
    consent: {
      contestSpecificOptIn: Boolean(input.contestSpecificOptIn),
      generalOptIn: Boolean(input.generalOptIn),
    },
    source: input.source,
    utm: input.utm,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(routes.concursos.publico(input.slug));

  return {
    ok: true,
    benefitEligible: result.benefitEligible,
    message: result.benefitEligible
      ? "¡Listo! Te avisaremos cuando se abra el concurso. Además, tendrás acceso al precio promocional para interesados durante el período establecido."
      : "¡Listo! Te avisaremos cuando se abra el concurso. El período de acceso al precio promocional para interesados ya finalizó.",
  };
}

/** Cancela la notificación. La fila y la auditoría se conservan. */
export async function cancelContestInterestAction(input: {
  contestId: string;
  slug: string;
}): Promise<InterestActionResult> {
  const user = await getAuthUser();
  if (!user) {
    return { ok: false, requiresLogin: true, error: "Iniciá sesión para gestionar tus avisos." };
  }

  const ctx = await requestContext();
  const result = await cancelInterest({
    contestId: input.contestId,
    userId: user.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(routes.concursos.publico(input.slug));
  return { ok: true, benefitEligible: false, message: "Cancelaste los avisos de este concurso." };
}

/** Estado del interés del usuario actual. Sin sesión devuelve null. */
export async function getMyContestInterestAction(contestId: string) {
  const user = await getAuthUser();
  if (!user) return null;
  const interest = await getInterestForUser(contestId, user.id);
  if (!interest) return null;
  return {
    status: interest.status,
    registeredAt: interest.registeredAt,
    benefitEligible: interest.benefitEligible,
    benefitDeadlineAt: interest.benefitDeadlineAt,
    generalOptIn: interest.generalOptIn,
  };
}
