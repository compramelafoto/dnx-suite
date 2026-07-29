/**
 * Resolución de política financiera FotoRank (basis points; sin floats).
 * FREE → fee 0, sin orden. PAID → snapshot listo para DNX Payments (09B2).
 */

import { RegistrationError } from "./errors";

export type FeeSource = "NONE" | "ORGANIZER_DEFAULT" | "CONTEST_OVERRIDE";
export type PaymentMode = "FREE" | "PAID" | "INVITATION_ONLY";

export type ResolveFinanceInput = {
  paymentMode: PaymentMode | null;
  registrationPriceAmountMinor: number | null;
  currency: string | null;
  contestPlatformFeeBps: number | null;
  organizationPlatformFeeBps: number | null;
};

export type ResolvedFinancePolicy = {
  paymentMode: PaymentMode;
  registrationPriceMinor: number;
  currency: string;
  platformFeeBps: number;
  organizerNetBps: number;
  feeSource: FeeSource;
  /** Snapshot JSON-serializable guardado en la inscripción. */
  policySnapshot: {
    paymentMode: PaymentMode;
    registrationPriceMinor: number;
    currency: string;
    platformFeeBps: number;
    organizerNetBps: number;
    feeSource: FeeSource;
    resolvedAt: string;
  };
};

const BPS_MAX = 10_000;

export function assertValidBps(bps: number): void {
  if (!Number.isInteger(bps) || bps < 0 || bps > BPS_MAX) {
    throw new RegistrationError(
      "INVALID_FEE_BPS",
      `platformFeeBps debe ser entero entre 0 y ${BPS_MAX} (basis points).`,
    );
  }
}

export function assertNonNegativePrice(priceMinor: number): void {
  if (!Number.isInteger(priceMinor) || priceMinor < 0) {
    throw new RegistrationError("INVALID_PRICE", "El precio debe ser un entero ≥ 0 en unidades mínimas.");
  }
}

/**
 * Resuelve fee efectivo: override de concurso > default organizador > 0.
 * FREE fuerza fee 0 y feeSource NONE.
 */
export function resolveFinancePolicy(input: ResolveFinanceInput, now = new Date()): ResolvedFinancePolicy {
  const mode = input.paymentMode;
  if (!mode) {
    throw new RegistrationError("CONTEST_NOT_OPEN", "El concurso no tiene modalidad de inscripción configurada.");
  }
  if (mode === "INVITATION_ONLY") {
    throw new RegistrationError(
      "INVITATION_ONLY_UNSUPPORTED",
      "INVITATION_ONLY aún no está disponible para inscripción pública.",
      501,
    );
  }

  if (mode === "FREE") {
    const policy: ResolvedFinancePolicy = {
      paymentMode: "FREE",
      registrationPriceMinor: 0,
      currency: (input.currency?.trim() || "ARS").toUpperCase(),
      platformFeeBps: 0,
      organizerNetBps: BPS_MAX,
      feeSource: "NONE",
      policySnapshot: {
        paymentMode: "FREE",
        registrationPriceMinor: 0,
        currency: (input.currency?.trim() || "ARS").toUpperCase(),
        platformFeeBps: 0,
        organizerNetBps: BPS_MAX,
        feeSource: "NONE",
        resolvedAt: now.toISOString(),
      },
    };
    return policy;
  }

  // PAID
  const price = input.registrationPriceAmountMinor ?? 0;
  assertNonNegativePrice(price);
  if (price <= 0) {
    throw new RegistrationError("INVALID_PRICE", "Un concurso PAID debe tener precio > 0.");
  }
  const currency = input.currency?.trim().toUpperCase();
  if (!currency) {
    throw new RegistrationError("INVALID_PRICE", "Un concurso PAID debe declarar moneda.");
  }

  let platformFeeBps = 0;
  let feeSource: FeeSource = "NONE";
  if (input.contestPlatformFeeBps != null) {
    assertValidBps(input.contestPlatformFeeBps);
    platformFeeBps = input.contestPlatformFeeBps;
    feeSource = "CONTEST_OVERRIDE";
  } else if (input.organizationPlatformFeeBps != null) {
    assertValidBps(input.organizationPlatformFeeBps);
    platformFeeBps = input.organizationPlatformFeeBps;
    feeSource = "ORGANIZER_DEFAULT";
  } else {
    platformFeeBps = 0;
    feeSource = "NONE";
  }

  const organizerNetBps = BPS_MAX - platformFeeBps;
  return {
    paymentMode: "PAID",
    registrationPriceMinor: price,
    currency,
    platformFeeBps,
    organizerNetBps,
    feeSource,
    policySnapshot: {
      paymentMode: "PAID",
      registrationPriceMinor: price,
      currency,
      platformFeeBps,
      organizerNetBps,
      feeSource,
      resolvedAt: now.toISOString(),
    },
  };
}
