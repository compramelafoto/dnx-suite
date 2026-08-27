/**
 * Registro de interés ("Notificarme") — decisiones puras, sin acceso a datos.
 *
 * Toda la política vive acá para poder probarla sin base de datos; `service.ts`
 * se limita a leer, aplicar estas funciones y persistir.
 *
 * Idempotencia: repetir "Notificarme" no crea filas nuevas, no reescribe
 * `registeredAt` y no extiende `benefitDeadlineAt`.
 */

import { acceptsInterestRegistration } from "./lifecycle";
import { CURRENT_CONSENT_VERSION, validateConsent, type ConsentInput } from "./consent";

export type InterestStatus = "ACTIVE" | "CANCELLED" | "CONVERTED";

export type ExistingInterest = {
  id: string;
  status: InterestStatus;
  registeredAt: Date;
  benefitDeadlineAt: Date | null;
  benefitEligible: boolean;
  consentVersion: string;
  generalOptIn: boolean;
};

export type InterestContestContext = {
  contestId: string;
  status: string;
  /** Cierre de la captación con beneficio. null = sin beneficio configurado. */
  interestBenefitCutoffAt: Date | null;
  /** Fecha límite para pagar con el precio promocional. */
  benefitDeadlineAt: Date | null;
};

export type RegisterInterestInput = {
  now: Date;
  contest: InterestContestContext;
  existing: ExistingInterest | null;
  consent: ConsentInput;
  source?: string;
  utm?: { source?: string | null; medium?: string | null; campaign?: string | null };
};

export type RegisterInterestDecision =
  | { action: "REJECT"; error: string }
  | {
      action: "CREATE";
      data: {
        registeredAt: Date;
        benefitEligible: boolean;
        benefitDeadlineAt: Date | null;
        consentVersion: string;
        consentAcceptedAt: Date;
        contestSpecificOptIn: true;
        generalOptIn: boolean;
        generalOptInAt: Date | null;
        source: string;
        utmSource: string | null;
        utmMedium: string | null;
        utmCampaign: string | null;
      };
      auditAction: "REGISTERED";
    }
  | {
      /** Ya existía y sigue activo: no se modifica nada salvo el opt-in general. */
      action: "NOOP";
      generalOptInChanged: boolean;
      generalOptIn: boolean;
      auditAction: "REPEATED" | "GENERAL_OPT_IN_CHANGED";
    }
  | {
      /** Estaba cancelado: se reactiva conservando la elegibilidad original. */
      action: "REACTIVATE";
      data: {
        generalOptIn: boolean;
        generalOptInAt: Date | null;
        consentVersion: string;
        consentAcceptedAt: Date;
      };
      auditAction: "REACTIVATED";
    };

/**
 * Elegibilidad al beneficio: se registró en o antes del corte.
 * El instante exacto del corte todavía es elegible.
 */
export function isBenefitEligibleAt(now: Date, cutoffAt: Date | null): boolean {
  if (!cutoffAt) return false;
  return now.getTime() <= cutoffAt.getTime();
}

export function decideRegisterInterest(input: RegisterInterestInput): RegisterInterestDecision {
  const { now, contest, existing, consent } = input;

  if (!acceptsInterestRegistration(contest.status)) {
    return {
      action: "REJECT",
      error: "Este concurso no está aceptando registros de interés en este momento.",
    };
  }

  const consentCheck = validateConsent(consent);
  if (!consentCheck.ok) {
    return { action: "REJECT", error: consentCheck.error };
  }

  if (existing) {
    if (existing.status === "CONVERTED") {
      return { action: "REJECT", error: "Ya estás inscripto en este concurso." };
    }

    if (existing.status === "ACTIVE") {
      // Idempotente: no se toca registeredAt ni benefitDeadlineAt.
      const changed = consent.generalOptIn !== existing.generalOptIn;
      return {
        action: "NOOP",
        generalOptInChanged: changed,
        generalOptIn: consent.generalOptIn,
        auditAction: changed ? "GENERAL_OPT_IN_CHANGED" : "REPEATED",
      };
    }

    // CANCELLED → reactivar sin recalcular la elegibilidad original.
    return {
      action: "REACTIVATE",
      data: {
        generalOptIn: consent.generalOptIn,
        generalOptInAt: consent.generalOptIn ? now : null,
        consentVersion: CURRENT_CONSENT_VERSION,
        consentAcceptedAt: now,
      },
      auditAction: "REACTIVATED",
    };
  }

  const eligible = isBenefitEligibleAt(now, contest.interestBenefitCutoffAt);

  return {
    action: "CREATE",
    data: {
      registeredAt: now,
      benefitEligible: eligible,
      benefitDeadlineAt: eligible ? contest.benefitDeadlineAt : null,
      consentVersion: CURRENT_CONSENT_VERSION,
      consentAcceptedAt: now,
      contestSpecificOptIn: true,
      generalOptIn: consent.generalOptIn,
      generalOptInAt: consent.generalOptIn ? now : null,
      source: input.source?.trim() || "PUBLIC_CARD",
      utmSource: input.utm?.source?.trim() || null,
      utmMedium: input.utm?.medium?.trim() || null,
      utmCampaign: input.utm?.campaign?.trim() || null,
    },
    auditAction: "REGISTERED",
  };
}

export type CancelInterestDecision =
  | { action: "REJECT"; error: string }
  | { action: "CANCEL"; cancelledAt: Date; auditAction: "CANCELLED" }
  | { action: "NOOP"; auditAction: "CANCELLED" };

/**
 * Cancelar marca la fila como CANCELLED. Nunca la borra: la auditoría y el
 * historial de consentimiento deben sobrevivir a la baja.
 */
export function decideCancelInterest(input: {
  now: Date;
  existing: ExistingInterest | null;
}): CancelInterestDecision {
  const { now, existing } = input;
  if (!existing) {
    return { action: "REJECT", error: "No tenés un registro de interés en este concurso." };
  }
  if (existing.status === "CONVERTED") {
    return {
      action: "REJECT",
      error:
        "Ya estás inscripto: las comunicaciones operativas de tu participación no pueden cancelarse desde acá.",
    };
  }
  if (existing.status === "CANCELLED") {
    return { action: "NOOP", auditAction: "CANCELLED" };
  }
  return { action: "CANCEL", cancelledAt: now, auditAction: "CANCELLED" };
}

/** Elegibilidad para el precio promocional, tal como la consume `pricing.ts`. */
export function toPricingEligibility(interest: ExistingInterest | null) {
  if (!interest) return null;
  return {
    benefitEligible: interest.benefitEligible,
    benefitDeadlineAt: interest.benefitDeadlineAt,
    active: interest.status === "ACTIVE" || interest.status === "CONVERTED",
  };
}

// ---------------------------------------------------------------------------
// Métricas administrativas
// ---------------------------------------------------------------------------

export type InterestStatsInput = Array<{ status: InterestStatus; benefitEligible: boolean }>;

export type InterestStats = {
  total: number;
  active: number;
  cancelled: number;
  converted: number;
  benefitEligible: number;
  /** Convertidos sobre el total registrado, en porcentaje con 2 decimales. */
  conversionRate: number;
};

export function computeInterestStats(rows: InterestStatsInput): InterestStats {
  const total = rows.length;
  let active = 0;
  let cancelled = 0;
  let converted = 0;
  let benefitEligible = 0;
  for (const r of rows) {
    if (r.status === "ACTIVE") active += 1;
    else if (r.status === "CANCELLED") cancelled += 1;
    else if (r.status === "CONVERTED") converted += 1;
    if (r.benefitEligible) benefitEligible += 1;
  }
  const conversionRate = total === 0 ? 0 : Math.round((converted / total) * 10000) / 100;
  return { total, active, cancelled, converted, benefitEligible, conversionRate };
}
