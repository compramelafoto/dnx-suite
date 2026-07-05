import { describe, expect, it, vi } from "vitest";
import {
  defaultEconomicIndexProvider,
  getSuggestedInstallmentInterestRate,
} from "./economic-index-provider";
import { resolveDefaultEconomicIndexType } from "./economic-index-defaults";
import * as economicDataService from "../economic-data/economic-data-service";
import { INITIAL_CUANTO_COBRO_PAYMENT_OPTIONS } from "./payment-options-types";
import {
  buildPaymentOptionsSnapshot,
  calculateCashPrice,
  calculateFinancedTotal,
  calculateInstallmentAmount,
  parsePaymentOptionsSnapshot,
  resolvePaymentBasePrice,
} from "./payment-options-calc";
import { createEmptyInstallmentPlan } from "./normalize-payment-options";
import { buildCommercialPaymentCards } from "../commercial-proposal/build-commercial-payment-cards";

describe("calculateCashPrice", () => {
  it("aplica descuento porcentual sobre el precio base", () => {
    expect(calculateCashPrice(1_000_000, 10)).toBe(900_000);
    expect(calculateCashPrice(500_000, 0)).toBe(500_000);
  });
});

describe("calculateFinancedTotal", () => {
  it("calcula cuotas sin interés", () => {
    expect(calculateFinancedTotal(1_000_000, 0)).toBe(1_000_000);
    expect(calculateInstallmentAmount(1_000_000, 3)).toBe(333_333);
  });

  it("calcula cuotas con interés manual", () => {
    const total = calculateFinancedTotal(1_000_000, 15);
    expect(total).toBe(1_150_000);
    expect(calculateInstallmentAmount(total, 3)).toBe(383_333);
  });
});

describe("resolvePaymentBasePrice", () => {
  it("prioriza chosenPriceEffective sobre recommendedBusinessPrice", () => {
    expect(
      resolvePaymentBasePrice({
        chosenPriceEffective: 900_000,
        recommendedBusinessPrice: 1_000_000,
      }),
    ).toBe(900_000);
  });
});

describe("buildCommercialPaymentCards", () => {
  it("presenta formas de pago sin lenguaje técnico de índices", () => {
    const cards = buildCommercialPaymentCards(
      {
        schemaVersion: 1,
        basePrice: 1_000_000,
        currency: "ARS",
        countryCode: "AR",
        calculatedAt: "2026-06-24T12:00:00.000Z",
        cash: {
          enabled: true,
          discountPercent: 10,
          basePrice: 1_000_000,
          cashPrice: 900_000,
          commercialNote: "",
        },
        installmentPlans: [
          {
            id: "p1",
            numberOfInstallments: 3,
            interestMode: "index_suggested",
            interestPercent: 21,
            financedTotal: 1_210_000,
            installmentAmount: 403_334,
            commercialNote: "",
            rateSource: "index",
            rateMetadata: null,
          },
        ],
      },
      (amount) => `$${amount}`,
    );

    expect(cards).toHaveLength(2);
    expect(cards[1]?.subtitle).toContain("Total del plan");
    expect(JSON.stringify(cards).toLowerCase()).not.toContain("ipc");
    expect(JSON.stringify(cards).toLowerCase()).not.toContain("bcra");
  });
});

describe("buildPaymentOptionsSnapshot", () => {
  it("congela descuento contado y planes de cuotas", () => {
    const snapshot = buildPaymentOptionsSnapshot({
      basePrice: 1_000_000,
      currency: "ARS",
      countryCode: "AR",
      calculatedAt: "2026-06-24T12:00:00.000Z",
      paymentOptions: {
        ...INITIAL_CUANTO_COBRO_PAYMENT_OPTIONS,
        cashEnabled: true,
        cashDiscountPercent: "10",
        installmentPlans: [
          {
            ...createEmptyInstallmentPlan(),
            numberOfInstallments: "3",
            interestMode: "manual",
            interestPercent: "15",
          },
        ],
      },
    });

    expect(snapshot.basePrice).toBe(1_000_000);
    expect(snapshot.cash?.cashPrice).toBe(900_000);
    expect(snapshot.installmentPlans[0]?.financedTotal).toBe(1_150_000);
    expect(snapshot.installmentPlans[0]?.installmentAmount).toBe(383_333);
    expect(snapshot.calculatedAt).toBe("2026-06-24T12:00:00.000Z");
  });

  it("re-parsea snapshot congelado sin recalcular estructura", () => {
    const snapshot = buildPaymentOptionsSnapshot({
      basePrice: 800_000,
      currency: "ARS",
      countryCode: "AR",
      paymentOptions: {
        ...INITIAL_CUANTO_COBRO_PAYMENT_OPTIONS,
        cashEnabled: true,
        cashDiscountPercent: "5",
      },
    });

    const parsed = parsePaymentOptionsSnapshot(snapshot);
    expect(parsed?.cash?.cashPrice).toBe(760_000);
    expect(parsed?.basePrice).toBe(800_000);
  });
});

describe("resolveDefaultEconomicIndexType", () => {
  it("usa inflación (IPC) para Argentina", () => {
    expect(resolveDefaultEconomicIndexType("AR")).toBe("inflation");
    expect(resolveDefaultEconomicIndexType("ars")).toBe("inflation");
    expect(resolveDefaultEconomicIndexType("Argentina")).toBe("inflation");
  });

  it("usa tasa de interés para otros países", () => {
    expect(resolveDefaultEconomicIndexType("UY")).toBe("interest_rate");
  });
});

describe("economic index fallback", () => {
  it("consulta inflación por defecto en Argentina", async () => {
    const spy = vi.spyOn(economicDataService, "getEconomicIndexSuggestion").mockResolvedValue({
      available: true,
      countryCode: "AR",
      type: "inflation",
      sourceLabel: "IPC Argentina - datos.gob.ar (INDEC)",
      queriedAt: "2026-06-24T12:00:00.000Z",
      suggestedAnnualRate: 42.5,
      suggestedMonthlyRate: 3.1,
      method: "ipc_average_6m",
      latestPeriod: "2026-05-01",
    });

    const lookup = await getSuggestedInstallmentInterestRate("AR", defaultEconomicIndexProvider);
    expect(spy).toHaveBeenCalledWith("AR", "inflation");
    expect(lookup.available).toBe(true);
    expect(lookup.metadata?.indexKind).toBe("inflation");
    expect(lookup.suggestedInterestPercent).toBe(42.5);

    spy.mockRestore();
  });

  it("ofrece tasa sugerida para Argentina vía proveedor async", async () => {
    const mockProvider = {
      async getSuggestedInstallmentInterestRate(countryCode: string) {
        if (countryCode !== "AR") {
          return {
            available: false,
            countryCode,
            suggestedInterestPercent: null,
            metadata: null,
            unavailableMessage: "No hay índice automático disponible para tu país todavía.",
          };
        }
        return {
          available: true,
          countryCode: "AR",
          suggestedInterestPercent: 42.5,
          metadata: {
            indexKind: "inflation" as const,
            countryCode: "AR",
            sourceLabel: "IPC Argentina - datos.gob.ar",
            queriedAt: "2026-06-24T12:00:00.000Z",
            suggestedPercent: 42.5,
            method: "inflation_proxy",
            suggestedAnnualRate: 42.5,
          },
          unavailableMessage: null,
        };
      },
    };

    const lookup = await getSuggestedInstallmentInterestRate("AR", mockProvider);
    expect(lookup.available).toBe(true);
    expect(lookup.suggestedInterestPercent).toBe(42.5);
    expect(lookup.metadata?.countryCode).toBe("AR");
  });

  it("cae a manual cuando no hay índice para el país", async () => {
    const lookup = await getSuggestedInstallmentInterestRate("BR", defaultEconomicIndexProvider);
    expect(lookup.available).toBe(false);
    expect(lookup.unavailableMessage).toMatch(/No hay índice automático/i);
  });

  it("congela snapshot con metadata de índice aplicada", () => {
    const snapshot = buildPaymentOptionsSnapshot({
      basePrice: 1_000_000,
      currency: "ARS",
      countryCode: "AR",
      paymentOptions: {
        ...INITIAL_CUANTO_COBRO_PAYMENT_OPTIONS,
        installmentPlans: [
          {
            ...createEmptyInstallmentPlan(),
            numberOfInstallments: "3",
            interestMode: "index_suggested",
            interestPercent: "21.25",
            appliedIndexMetadata: {
              indexKind: "interest_rate",
              countryCode: "AR",
              sourceLabel: "BCRA - BADLAR",
              queriedAt: "2026-06-24T12:00:00.000Z",
              suggestedPercent: 21.25,
              method: "bcra_badlar",
              latestPeriod: "2026-06-25",
              suggestedAnnualRate: 21.25,
            },
          },
        ],
      },
    });

    expect(snapshot.installmentPlans[0]?.rateSource).toBe("index");
    expect(snapshot.installmentPlans[0]?.rateMetadata?.method).toBe("bcra_badlar");
    expect(snapshot.installmentPlans[0]?.interestPercent).toBe(21.25);
  });
});
