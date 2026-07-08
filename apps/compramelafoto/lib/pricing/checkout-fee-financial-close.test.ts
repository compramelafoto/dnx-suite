import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { feeFromTotal, totalFromBase } from "@/lib/pricing/fee-formula";
import { computePrintPricing } from "@/lib/pricing/print-pricing";
import {
  CHECKOUT_FEE_FINANCIAL_BASE_ARS,
  closeCheckoutFinancials,
} from "@/lib/pricing/checkout-fee-financial-close";

const BASE = CHECKOUT_FEE_FINANCIAL_BASE_ARS;
const FEE_PCT = 15;
const CLIENT = 11_500;
const FEE_GROSS = 1_500;
const ORG_PCT = 10;
const ORG_EVENT = 1_000;
const SCHOOL_PCT = 10;
const SCHOOL_AMOUNT = 1_000;
const REFERRAL_BALANCE = 500;
const REFERRAL_DISCOUNT = 500;
const FEE_NET = 1_000;
const REFERRAL_EARNING = 500;
const CLF_NET = 500;

describe("closeCheckoutFinancials — BASE=10000, fee 15%", () => {
  it("NORMAL cierra exacto", () => {
    const r = closeCheckoutFinancials({
      scenario: "NORMAL",
      marketplaceFeePercent: FEE_PCT,
    });
    assert.equal(r.clienteArs, CLIENT);
    assert.equal(r.feeGrossArs, FEE_GROSS);
    assert.equal(r.feeNetMpArs, FEE_GROSS);
    assert.equal(r.organizerEventArs, 0);
    assert.equal(r.organizerSchoolArs, 0);
    assert.equal(r.referralEarningArs, 0);
    assert.equal(r.clfNetArs, FEE_GROSS);
    assert.equal(r.photographerMpArs, BASE);
    assert.equal(r.marketplaceFeeMpArs, FEE_GROSS);
    assert.equal(r.closesExactly, true);
  });

  it("REFERRAL — descuento y reparto 50/50", () => {
    const r = closeCheckoutFinancials({
      scenario: "REFERRAL",
      marketplaceFeePercent: FEE_PCT,
      referralBalanceArs: REFERRAL_BALANCE,
    });
    assert.equal(r.clienteArs, CLIENT);
    assert.equal(r.feeGrossArs, FEE_GROSS);
    assert.equal(r.referralDiscountArs, REFERRAL_DISCOUNT);
    assert.equal(r.feeNetMpArs, FEE_NET);
    assert.equal(r.referralEarningArs, REFERRAL_EARNING);
    assert.equal(r.clfNetArs, CLF_NET);
    assert.equal(r.photographerMpArs, CLIENT - FEE_NET);
    assert.equal(r.closesExactly, true);
  });

  it("EVENT_ORGANIZER — retención sobre base", () => {
    const r = closeCheckoutFinancials({
      scenario: "EVENT_ORGANIZER",
      marketplaceFeePercent: FEE_PCT,
      eventOrganizerPercent: ORG_PCT,
    });
    assert.equal(r.clienteArs, CLIENT);
    assert.equal(r.feeGrossArs, FEE_GROSS);
    assert.equal(r.organizerEventArs, ORG_EVENT);
    assert.equal(r.marketplaceFeeMpArs, FEE_GROSS + ORG_EVENT);
    assert.equal(r.photographerMpArs, 9_000);
    assert.equal(r.closesExactly, true);
  });

  it("EVENT_ORGANIZER_REFERRAL — organizador + referido", () => {
    const r = closeCheckoutFinancials({
      scenario: "EVENT_ORGANIZER_REFERRAL",
      marketplaceFeePercent: FEE_PCT,
      eventOrganizerPercent: ORG_PCT,
      referralBalanceArs: REFERRAL_BALANCE,
    });
    assert.equal(r.feeNetMpArs, FEE_NET);
    assert.equal(r.organizerEventArs, ORG_EVENT);
    assert.equal(r.marketplaceFeeMpArs, FEE_NET + ORG_EVENT);
    assert.equal(r.photographerMpArs, 9_500);
    assert.equal(r.referralEarningArs, REFERRAL_EARNING);
    assert.equal(r.closesExactly, true);
  });

  it("SCHOOL — comisión sobre total − fee", () => {
    const r = closeCheckoutFinancials({
      scenario: "SCHOOL",
      marketplaceFeePercent: FEE_PCT,
      schoolOrganizerPercent: SCHOOL_PCT,
    });
    assert.equal(r.clienteArs, CLIENT);
    assert.equal(r.feeGrossArs, FEE_GROSS);
    assert.equal(r.organizerSchoolArs, SCHOOL_AMOUNT);
    assert.equal(r.organizerEventArs, 0);
    assert.equal(r.marketplaceFeeMpArs, FEE_GROSS);
    assert.equal(r.photographerMpArs, BASE);
    assert.equal(r.closesExactly, true);
  });

  it("COLLABORATIVE — mismo cierre que organizador evento", () => {
    const r = closeCheckoutFinancials({
      scenario: "COLLABORATIVE",
      marketplaceFeePercent: FEE_PCT,
      eventOrganizerPercent: ORG_PCT,
    });
    assert.equal(r.organizerEventArs, ORG_EVENT);
    assert.equal(r.photographerMpArs, 9_000);
    assert.equal(r.closesExactly, true);
  });

  it("EVENT_ORGANIZER al 100% — organizador collector, fee solo plataforma (CLF-ORGANIZER-AS-COLLECTOR-100)", () => {
    const r = closeCheckoutFinancials({
      scenario: "EVENT_ORGANIZER",
      marketplaceFeePercent: FEE_PCT,
      eventOrganizerPercent: 100,
    });
    assert.equal(r.organizerEventArs, BASE);
    assert.equal(r.photographerMpArs, BASE);
    assert.equal(r.marketplaceFeeMpArs, FEE_GROSS);
    assert.equal(r.closesExactly, true);
  });

  it("MIXED — líneas con fee distinto, marketplace unificado R1", () => {
    const digitalClient = totalFromBase(5_000, FEE_PCT);
    const printClient = computePrintPricing({
      baseUnitPrice: 5_000,
      albumMarginPercent: 0,
      platformFeePercent: 12,
      quantity: 1,
    }).subtotal;
    const expectedCliente = digitalClient + printClient;
    const expectedFee = feeFromTotal(expectedCliente, FEE_PCT);

    const r = closeCheckoutFinancials({
      scenario: "MIXED",
      marketplaceFeePercent: FEE_PCT,
      printLineFeePercent: 12,
      mixedDigitalBaseArs: 5_000,
      mixedPrintBaseArs: 5_000,
    });
    assert.equal(r.clienteArs, expectedCliente);
    assert.equal(r.feeGrossArs, expectedFee);
    assert.equal(r.closesExactly, true);
  });

  it("PACK — album pack con organizador evento", () => {
    const r = closeCheckoutFinancials({
      scenario: "PACK",
      marketplaceFeePercent: FEE_PCT,
      eventOrganizerPercent: ORG_PCT,
    });
    assert.equal(r.clienteArs, CLIENT);
    assert.equal(r.organizerEventArs, ORG_EVENT);
    assert.equal(r.photographerMpArs, 9_000);
    assert.equal(r.closesExactly, true);
  });

  it("PREVENTA — escolar sin retención MP evento", () => {
    const r = closeCheckoutFinancials({
      scenario: "PREVENTA",
      marketplaceFeePercent: FEE_PCT,
      schoolOrganizerPercent: SCHOOL_PCT,
    });
    assert.equal(r.organizerSchoolArs, SCHOOL_AMOUNT);
    assert.equal(r.organizerEventArs, 0);
    assert.equal(r.marketplaceFeeMpArs, FEE_GROSS);
    assert.equal(r.closesExactly, true);
  });

  it("REFERRAL con organizador referido — 50% + 20% sobre fee neto", () => {
    const r = closeCheckoutFinancials({
      scenario: "REFERRAL",
      marketplaceFeePercent: FEE_PCT,
      referralBalanceArs: REFERRAL_BALANCE,
      referredOrganizer: true,
    });
    assert.equal(r.feeNetMpArs, FEE_NET);
    assert.equal(r.referralEarningArs, 700);
    assert.equal(r.clfNetArs, 300);
  });
});
