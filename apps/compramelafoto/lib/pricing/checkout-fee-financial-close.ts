/**
 * Cierre financiero puro para la suite Fase 1.5.
 * Usa fórmulas existentes (fee-formula, referidos, organizador evento) sin alterar reglas.
 */
import { ReferralProgram } from "@prisma/client";
import { baseFromTotal, feeFromBase, feeFromTotal, totalFromBase } from "@/lib/pricing/fee-formula";
import { applyEventOrganizerRetentionToMercadoPagoMarketplaceFeePesos } from "@/lib/event-organizer-commission-mp-marketplace-fee";
import {
  applyReferralDiscountToMarketplaceFeeAmount,
  computeReferralEarningsBreakdown,
} from "@/lib/referral/referral-marketplace-fee";
import { computePrintPricing } from "@/lib/pricing/print-pricing";
import {
  CHECKOUT_FEE_FINANCIAL_BASE_ARS,
  type CheckoutFeeComponent,
} from "@/lib/pricing/checkout-fee-types";

export { CHECKOUT_FEE_FINANCIAL_BASE_ARS };

export type CheckoutFinancialScenario =
  | "NORMAL"
  | "REFERRAL"
  | "EVENT_ORGANIZER"
  | "EVENT_ORGANIZER_REFERRAL"
  | "SCHOOL"
  | "COLLABORATIVE"
  | "MIXED"
  | "PACK"
  | "PREVENTA";

export type CloseCheckoutFinancialsInput = {
  scenario: CheckoutFinancialScenario;
  /** Precio base fotógrafo (ARS). Default suite: 10_000. */
  photographerBaseArs?: number;
  /** % fee marketplace canónico (R1) sobre total / base digital. */
  marketplaceFeePercent: number;
  /** % fee línea impresión (R2) cuando aplica. */
  printLineFeePercent?: number;
  albumMarginPercent?: number;
  /** Solo MIXED: reparto de base entre digital e impresión. */
  mixedDigitalBaseArs?: number;
  mixedPrintBaseArs?: number;
  eventOrganizerPercent?: number;
  schoolOrganizerPercent?: number;
  referralBalanceArs?: number;
  extensionSurchargeArs?: number;
  /** Organizador del evento referido: suma ORGANIZER_REFERRAL (20%) al fee efectivo. */
  referredOrganizer?: boolean;
};

export type CloseCheckoutFinancialsResult = {
  scenario: CheckoutFinancialScenario;
  clienteArs: number;
  feeGrossArs: number;
  feeNetMpArs: number;
  organizerEventArs: number;
  organizerSchoolArs: number;
  referralDiscountArs: number;
  referralEarningArs: number;
  clfNetArs: number;
  marketplaceFeeMpArs: number;
  /** Neto MP del cobrador OAuth (puede ser organizador al 100%). Ver MP_COLLECTOR_NET_AMOUNT_NOTE. */
  collectorNetAmountPesos: number;
  /**
   * @deprecated Usar collectorNetAmountPesos. Ver MP_COLLECTOR_NET_AMOUNT_NOTE en event-organizer-commission-mp-marketplace-fee.
   */
  photographerMpArs: number;
  /** Identidad: cliente = neto collector MP + marketplace_fee MP (+ escolar no va a MP). */
  closesExactly: boolean;
};

function schoolOrganizerAmount(totalArs: number, platformFeeArs: number, percent: number): number {
  const base = Math.max(0, totalArs - platformFeeArs);
  return Math.max(0, Math.round((base * percent) / 100));
}

function digitalClientFromBase(baseArs: number, feePercent: number): number {
  return totalFromBase(baseArs, feePercent);
}

function buildMixedCliente(params: {
  digitalBaseArs: number;
  printBaseArs: number;
  digitalFeePercent: number;
  printFeePercent: number;
  albumMarginPercent: number;
}): { clienteArs: number; digitalClientArs: number; printClientArs: number } {
  const digitalClientArs = digitalClientFromBase(params.digitalBaseArs, params.digitalFeePercent);
  const printBreakdown = computePrintPricing({
    baseUnitPrice: params.printBaseArs,
    albumMarginPercent: params.albumMarginPercent,
    platformFeePercent: params.printFeePercent,
    quantity: 1,
  });
  const printClientArs = printBreakdown.subtotal;
  return {
    clienteArs: digitalClientArs + printClientArs,
    digitalClientArs,
    printClientArs,
  };
}

/**
 * Cierra montos cliente / fee / organizador / referido / CLF para un escenario.
 */
export function closeCheckoutFinancials(
  input: CloseCheckoutFinancialsInput
): CloseCheckoutFinancialsResult {
  const baseArs = input.photographerBaseArs ?? CHECKOUT_FEE_FINANCIAL_BASE_ARS;
  const feePct = input.marketplaceFeePercent;
  const extensionArs = Math.max(0, Math.round(input.extensionSurchargeArs ?? 0));
  const printFeePct = input.printLineFeePercent ?? feePct;
  const marginPct = input.albumMarginPercent ?? 0;

  let clienteArs: number;
  if (input.scenario === "MIXED") {
    const digitalBase = input.mixedDigitalBaseArs ?? Math.round(baseArs / 2);
    const printBase = input.mixedPrintBaseArs ?? baseArs - digitalBase;
    clienteArs = buildMixedCliente({
      digitalBaseArs: digitalBase,
      printBaseArs: printBase,
      digitalFeePercent: feePct,
      printFeePercent: printFeePct,
      albumMarginPercent: marginPct,
    }).clienteArs;
  } else {
    clienteArs = digitalClientFromBase(baseArs, feePct);
  }
  clienteArs += extensionArs;

  const feeGrossArs =
    feeFromTotal(clienteArs - extensionArs, feePct) + extensionArs;

  const referralBalance = Math.max(0, Math.round(input.referralBalanceArs ?? 0));
  const referralDiscount =
    input.scenario === "REFERRAL" || input.scenario === "EVENT_ORGANIZER_REFERRAL"
      ? applyReferralDiscountToMarketplaceFeeAmount({
          marketplaceFeeCents: feeGrossArs,
          referralBalanceCents: referralBalance,
        })
      : { marketplaceFeeCents: feeGrossArs, discountCents: 0 };

  const feeNetMpArs = referralDiscount.marketplaceFeeCents;
  const referralDiscountArs = referralDiscount.discountCents;

  const hasPhotographerReferralScenario =
    input.scenario === "REFERRAL" || input.scenario === "EVENT_ORGANIZER_REFERRAL";

  let referralEarningArs = 0;
  let clfNetArs = feeNetMpArs;

  if (hasPhotographerReferralScenario && feeNetMpArs > 0) {
    const programs: ReferralProgram[] = [ReferralProgram.PHOTOGRAPHER_REFERRAL];
    if (input.referredOrganizer) {
      programs.push(ReferralProgram.ORGANIZER_REFERRAL);
    }
    const breakdown = computeReferralEarningsBreakdown({
      effectivePlatformFeeCents: feeNetMpArs,
      programs,
    });
    if (breakdown) {
      referralEarningArs = breakdown.totalReferralAmountCents;
      clfNetArs = breakdown.platformNetResidualCents;
    }
  }

  const hasEventOrganizer =
    input.scenario === "EVENT_ORGANIZER" ||
    input.scenario === "EVENT_ORGANIZER_REFERRAL" ||
    input.scenario === "COLLABORATIVE" ||
    input.scenario === "PACK";

  const eventOrganizerPct = hasEventOrganizer ? (input.eventOrganizerPercent ?? 10) : 0;
  const organizerAsCollector = hasEventOrganizer && eventOrganizerPct === 100;

  const mpSplit = applyEventOrganizerRetentionToMercadoPagoMarketplaceFeePesos({
    orderId: 0,
    albumId: 0,
    eventId: hasEventOrganizer ? 1 : null,
    totalPaidPesos: clienteArs,
    extensionSurchargePesos: extensionArs,
    platformPercent: feePct,
    marketplaceFeePlatformOnlyPesos: feeNetMpArs,
    event:
      hasEventOrganizer && eventOrganizerPct > 0
        ? {
            organizerCommissionEnabled: true,
            organizerCommissionPercentage: eventOrganizerPct,
          }
        : null,
    paymentCollectorType: organizerAsCollector ? "ORGANIZER" : "PHOTOGRAPHER",
  });

  const organizerEventArs = mpSplit.organizerCommissionAmountPesos;
  const marketplaceFeeMpArs = mpSplit.marketplaceFeePesos;
  const collectorNetAmountPesos = mpSplit.amountToCollectorPesos;

  const hasSchool =
    input.scenario === "SCHOOL" || input.scenario === "PREVENTA";
  const schoolPct = hasSchool ? (input.schoolOrganizerPercent ?? 10) : 0;
  const organizerSchoolArs = hasSchool
    ? schoolOrganizerAmount(clienteArs, feeGrossArs, schoolPct)
    : 0;

  const closesExactly = collectorNetAmountPesos + marketplaceFeeMpArs === clienteArs;

  return {
    scenario: input.scenario,
    clienteArs,
    feeGrossArs,
    feeNetMpArs,
    organizerEventArs,
    organizerSchoolArs,
    referralDiscountArs,
    referralEarningArs,
    clfNetArs,
    marketplaceFeeMpArs,
    collectorNetAmountPesos,
    photographerMpArs: collectorNetAmountPesos,
    closesExactly,
  };
}

/** Helper para tests: fee y cliente desde base con % canónico. */
export function expectedClienteAndFeeFromBase(
  baseArs: number,
  marketplaceFeePercent: number
): { clienteArs: number; feeGrossArs: number } {
  const clienteArs = totalFromBase(baseArs, marketplaceFeePercent);
  const feeGrossArs = feeFromBase(baseArs, marketplaceFeePercent);
  return { clienteArs, feeGrossArs };
}

export function componentLineFeePercent(params: {
  component: CheckoutFeeComponent;
  marketplaceFeePercent: number;
  printLineFeePercent: number;
}): number {
  return params.component === "PRINT" ? params.printLineFeePercent : params.marketplaceFeePercent;
}
