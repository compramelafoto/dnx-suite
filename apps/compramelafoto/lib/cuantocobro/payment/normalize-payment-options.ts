import type {
  CuantoCobroInstallmentInterestMode,
  CuantoCobroInstallmentPlanInput,
  CuantoCobroPaymentOptionsInput,
} from "./payment-options-types";
import type { EconomicIndexRateMetadata } from "./economic-index-types";
import { INITIAL_CUANTO_COBRO_PAYMENT_OPTIONS } from "./payment-options-types";

const INSTALLMENT_MODES: CuantoCobroInstallmentInterestMode[] = ["none", "manual", "index_suggested"];

function newPlanId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `plan-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeInstallmentPlan(raw: unknown): CuantoCobroInstallmentPlanInput | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const id = typeof record.id === "string" && record.id.trim() ? record.id.trim() : newPlanId();
  const interestMode = INSTALLMENT_MODES.includes(record.interestMode as CuantoCobroInstallmentInterestMode)
    ? (record.interestMode as CuantoCobroInstallmentInterestMode)
    : "none";

  return {
    id,
    numberOfInstallments: typeof record.numberOfInstallments === "string" ? record.numberOfInstallments : "",
    interestMode,
    interestPercent: typeof record.interestPercent === "string" ? record.interestPercent : "",
    commercialNote: typeof record.commercialNote === "string" ? record.commercialNote : "",
    appliedIndexMetadata: normalizeAppliedIndexMetadata(record.appliedIndexMetadata),
  };
}

function normalizeAppliedIndexMetadata(raw: unknown): EconomicIndexRateMetadata | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.sourceLabel !== "string" || typeof record.method !== "string") return null;
  return raw as EconomicIndexRateMetadata;
}

export function normalizePaymentOptions(
  raw?: Partial<CuantoCobroPaymentOptionsInput> | null,
): CuantoCobroPaymentOptionsInput {
  if (!raw || typeof raw !== "object") {
    return { ...INITIAL_CUANTO_COBRO_PAYMENT_OPTIONS, installmentPlans: [] };
  }

  const plans = Array.isArray(raw.installmentPlans)
    ? raw.installmentPlans
        .map((plan) => normalizeInstallmentPlan(plan))
        .filter((plan): plan is CuantoCobroInstallmentPlanInput => plan != null)
    : [];

  return {
    cashEnabled: raw.cashEnabled ?? INITIAL_CUANTO_COBRO_PAYMENT_OPTIONS.cashEnabled,
    cashDiscountPercent:
      typeof raw.cashDiscountPercent === "string"
        ? raw.cashDiscountPercent
        : INITIAL_CUANTO_COBRO_PAYMENT_OPTIONS.cashDiscountPercent,
    cashCommercialNote:
      typeof raw.cashCommercialNote === "string"
        ? raw.cashCommercialNote
        : INITIAL_CUANTO_COBRO_PAYMENT_OPTIONS.cashCommercialNote,
    installmentPlans: plans,
  };
}

export function createEmptyInstallmentPlan(): CuantoCobroInstallmentPlanInput {
  return {
    id: newPlanId(),
    numberOfInstallments: "",
    interestMode: "none",
    interestPercent: "",
    commercialNote: "",
  };
}
