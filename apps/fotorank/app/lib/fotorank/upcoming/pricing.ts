/**
 * Resolución de precio del lado servidor.
 *
 * Regla dura: el precio JAMÁS se toma de la petición del cliente. Se calcula a
 * partir de (concurso, fecha UTC, timezone del concurso, elegibilidad del usuario,
 * cantidad de fotografías). Un monto enviado por el frontend sólo puede usarse
 * para *verificar* coincidencia y rechazar la operación si difiere.
 *
 * Los montos son SIEMPRE minor units enteras (centavos). Nunca Float.
 */

import type { ContestLifecyclePhase } from "./lifecycle";

export type PriceAudience = "INTEREST_EXCLUSIVE" | "GENERAL";

export type PricePhaseTier = {
  quantity: number;
  amountMinor: number;
  label?: string | null;
};

export type PricePhase = {
  code: string;
  name: string;
  audience: PriceAudience;
  /** Inclusive. */
  startsAt: Date;
  /** Inclusive: el instante exacto sigue vigente; 1 ms después vence. */
  endsAt: Date;
  currency: string;
  priority: number;
  isActive: boolean;
  tiers: PricePhaseTier[];
};

export type InterestEligibility = {
  /** El usuario registró interés dentro de la ventana de captación. */
  benefitEligible: boolean;
  /** Límite para completar el pago con el precio promocional. */
  benefitDeadlineAt: Date | null;
  /** Un interés cancelado no habilita el beneficio. */
  active: boolean;
};

export type PriceResolutionInput = {
  now: Date;
  quantity: number;
  phases: PricePhase[];
  /** null = usuario sin interés registrado (o anónimo). */
  eligibility: InterestEligibility | null;
};

export type ResolvedPrice = {
  phaseCode: string;
  phaseName: string;
  audience: PriceAudience;
  quantity: number;
  amountMinor: number;
  currency: string;
  /** True si el precio proviene de una fase exclusiva para interesados. */
  isPromotional: boolean;
};

export type PriceResolution =
  | { ok: true; price: ResolvedPrice }
  | { ok: false; reason: PriceUnavailableReason; message: string };

export type PriceUnavailableReason =
  | "NO_ACTIVE_PHASE"
  | "QUANTITY_NOT_OFFERED"
  | "INVALID_QUANTITY";

/** Una fase está vigente si `now` cae dentro de [startsAt, endsAt], ambos inclusive. */
export function isPhaseCurrent(phase: PricePhase, now: Date): boolean {
  if (!phase.isActive) return false;
  return now.getTime() >= phase.startsAt.getTime() && now.getTime() <= phase.endsAt.getTime();
}

/**
 * ¿El usuario puede usar una fase exclusiva para interesados?
 * Exige interés activo, elegible y dentro de su propia fecha límite de beneficio.
 */
export function canUseInterestExclusivePhase(
  eligibility: InterestEligibility | null,
  now: Date,
): boolean {
  if (!eligibility) return false;
  if (!eligibility.active) return false;
  if (!eligibility.benefitEligible) return false;
  if (eligibility.benefitDeadlineAt && now.getTime() > eligibility.benefitDeadlineAt.getTime()) {
    return false;
  }
  return true;
}

/**
 * Precio efectivo. Ante varias fases vigentes gana la de menor `priority`;
 * a igual prioridad, gana la más barata para el usuario.
 */
export function resolvePrice(input: PriceResolutionInput): PriceResolution {
  const { now, quantity, phases, eligibility } = input;

  if (!Number.isInteger(quantity) || quantity < 1) {
    return {
      ok: false,
      reason: "INVALID_QUANTITY",
      message: "La cantidad de fotografías debe ser un número entero mayor o igual a 1.",
    };
  }

  const promoAllowed = canUseInterestExclusivePhase(eligibility, now);

  const candidates = phases
    .filter((p) => isPhaseCurrent(p, now))
    .filter((p) => (p.audience === "INTEREST_EXCLUSIVE" ? promoAllowed : true));

  if (candidates.length === 0) {
    return {
      ok: false,
      reason: "NO_ACTIVE_PHASE",
      message: "No hay una etapa de precios vigente para esta fecha.",
    };
  }

  const withTier = candidates
    .map((phase) => ({ phase, tier: phase.tiers.find((t) => t.quantity === quantity) }))
    .filter((c): c is { phase: PricePhase; tier: PricePhaseTier } => Boolean(c.tier));

  if (withTier.length === 0) {
    return {
      ok: false,
      reason: "QUANTITY_NOT_OFFERED",
      message: `La etapa vigente no ofrece un paquete de ${quantity} fotografía(s).`,
    };
  }

  withTier.sort((a, b) => {
    if (a.phase.priority !== b.phase.priority) return a.phase.priority - b.phase.priority;
    return a.tier.amountMinor - b.tier.amountMinor;
  });

  const winner = withTier[0]!;
  return {
    ok: true,
    price: {
      phaseCode: winner.phase.code,
      phaseName: winner.phase.name,
      audience: winner.phase.audience,
      quantity,
      amountMinor: winner.tier.amountMinor,
      currency: winner.phase.currency,
      isPromotional: winner.phase.audience === "INTEREST_EXCLUSIVE",
    },
  };
}

/**
 * Verificación defensiva contra manipulación desde el cliente.
 * El monto del cliente NUNCA se usa como precio: sólo se compara con el del servidor.
 */
export function assertClientAmountMatches(
  serverPrice: ResolvedPrice,
  clientAmountMinor: unknown,
): { ok: true } | { ok: false; error: string } {
  if (typeof clientAmountMinor !== "number" || !Number.isInteger(clientAmountMinor)) {
    return { ok: false, error: "Monto inválido." };
  }
  if (clientAmountMinor !== serverPrice.amountMinor) {
    return {
      ok: false,
      error: "El precio cambió. Actualizá la página para ver el importe vigente.",
    };
  }
  return { ok: true };
}

/**
 * Las fases de precio son configuración administrativa: sólo pueden mostrarse
 * públicamente cuando el concurso ya abrió inscripciones.
 */
export function pricingIsPubliclyVisible(status: ContestLifecyclePhase | string): boolean {
  return status === "REGISTRATION_OPEN";
}

/** Formato ARS para administración y emails. Entrada en centavos. */
export function formatMinorAmount(amountMinor: number, currency = "ARS"): string {
  const value = amountMinor / 100;
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}
