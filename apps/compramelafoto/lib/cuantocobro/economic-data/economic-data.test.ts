import { describe, expect, it, vi } from "vitest";
import { EconomicDataService } from "./economic-data-service";
import {
  averageLastMonths,
  buildInflationSuggestionFromPoints,
  compoundAnnualRateFromMonthly,
  decimalToMonthlyPercent,
  parseDatosGobArPercentChangeSeries,
} from "./inflation-math";
import {
  AR_BCRA_BADLAR_VARIABLE_ID,
  AR_BCRA_POLICY_RATE_VARIABLE_ID,
  fetchArgentinaInterestRateSuggestion,
} from "./providers/argentina-provider";
import { economicIndexMetadataFromApiResponse } from "./economic-index-api-client";
import type { EconomicIndexApiResponse } from "./economic-index-api-client";
import { buildPaymentOptionsSnapshot } from "../payment/payment-options-calc";
import { createEmptyInstallmentPlan } from "../payment/normalize-payment-options";
import { INITIAL_CUANTO_COBRO_PAYMENT_OPTIONS } from "../payment/payment-options-types";
import { economicIndexMetadataFromApiResult } from "../payment/economic-index-provider";
import type { EconomicDataInterestRateResult } from "./economic-data-types";

const SAMPLE_IPC_PAYLOAD = {
  data: [
    ["2026-05-01", 0.034],
    ["2026-04-01", 0.028],
    ["2026-03-01", 0.031],
    ["2026-02-01", 0.025],
    ["2026-01-01", 0.022],
    ["2025-12-01", 0.027],
  ],
};

describe("inflation-math", () => {
  it("convierte decimal de datos.gob.ar a % mensual", () => {
    expect(decimalToMonthlyPercent(0.034)).toBeCloseTo(3.4, 4);
    expect(decimalToMonthlyPercent(0.028)).toBeCloseTo(2.8, 4);
  });

  it("calcula promedios 3/6/12 meses", () => {
    const points = parseDatosGobArPercentChangeSeries(SAMPLE_IPC_PAYLOAD);
    expect(points).toHaveLength(6);
    expect(averageLastMonths(points, 3)).toBeCloseTo((3.4 + 2.8 + 3.1) / 3, 4);
    expect(averageLastMonths(points, 6)).toBeCloseTo(
      (3.4 + 2.8 + 3.1 + 2.5 + 2.2 + 2.7) / 6,
      4,
    );
    expect(averageLastMonths(points, 12)).toBeCloseTo(
      (3.4 + 2.8 + 3.1 + 2.5 + 2.2 + 2.7) / 6,
      4,
    );
  });

  it("calcula tasa anual compuesta desde mensual", () => {
    const annual = compoundAnnualRateFromMonthly(3);
    expect(annual).toBeCloseTo((Math.pow(1.03, 12) - 1) * 100, 4);
  });

  it("arma sugerencia con promedio 6m por defecto", () => {
    const points = parseDatosGobArPercentChangeSeries(SAMPLE_IPC_PAYLOAD);
    const built = buildInflationSuggestionFromPoints(points, {
      sourceLabel: "test",
      seriesId: "test",
      queriedAt: "2026-06-24T12:00:00.000Z",
    });
    expect(built).not.toBeNull();
    expect(built?.suggestedMonthlyRate).toBeCloseTo((3.4 + 2.8 + 3.1 + 2.5 + 2.2 + 2.7) / 6, 4);
    expect(built?.suggestedAnnualRate).toBeCloseTo(
      compoundAnnualRateFromMonthly(built!.suggestedMonthlyRate),
      4,
    );
  });
});

describe("argentina provider fallback", () => {
  it("cae a manual cuando falla la API de IPC", async () => {
    const fetchJson = vi.fn().mockRejectedValue(new Error("network"));
    const result = await fetchArgentinaInterestRateSuggestion({ fetchJson });
    expect(result.available).toBe(false);
    expect(result.message).toMatch(/manualmente/i);
  });

  it("usa inflation_proxy cuando BCRA no está disponible", async () => {
    const fetchJson = vi.fn(async (url: string) => {
      if (url.includes("bcra.gob.ar")) {
        return { results: [] };
      }
      return SAMPLE_IPC_PAYLOAD;
    });

    const result = await fetchArgentinaInterestRateSuggestion({ fetchJson });
    expect(result.available).toBe(true);
    if (result.available && result.type === "interest_rate") {
      expect(result.method).toBe("inflation_proxy");
      expect(result.message).toMatch(/inflación histórica/i);
      expect(result.suggestedAnnualRate).toBeGreaterThan(0);
    }
  });

  it("prioriza BCRA BADLAR cuando política monetaria está desactualizada", async () => {
    const fetchJson = vi.fn(async (url: string) => {
      if (url.includes(`IdVariable=${AR_BCRA_POLICY_RATE_VARIABLE_ID}`)) {
        return {
          results: [
            {
              idVariable: AR_BCRA_POLICY_RATE_VARIABLE_ID,
              ultFechaInformada: "2025-01-01",
              ultValorInformado: 29,
            },
          ],
        };
      }
      if (url.includes(`IdVariable=${AR_BCRA_BADLAR_VARIABLE_ID}`)) {
        return {
          results: [
            {
              idVariable: AR_BCRA_BADLAR_VARIABLE_ID,
              descripcion: "BADLAR bancos privados",
              ultFechaInformada: new Date().toISOString().slice(0, 10),
              ultValorInformado: 21.25,
            },
          ],
        };
      }
      return SAMPLE_IPC_PAYLOAD;
    });

    const result = await fetchArgentinaInterestRateSuggestion({ fetchJson });
    expect(result.available).toBe(true);
    if (result.available && result.type === "interest_rate") {
      expect(result.method).toBe("bcra_badlar");
      expect(result.suggestedAnnualRate).toBe(21.25);
    }
  });
});

describe("EconomicDataService cache", () => {
  it("reutiliza cache en segunda consulta", async () => {
    const fetchJson = vi.fn(async (url: string) => {
      if (url.includes("bcra.gob.ar")) return { results: [] };
      return SAMPLE_IPC_PAYLOAD;
    });

    const service = new EconomicDataService({ fetchJson, useCache: true });
    const first = await service.getIndexSuggestion("AR", "inflation");
    const second = await service.getIndexSuggestion("AR", "inflation");

    expect(first.available).toBe(true);
    expect(second).toEqual(first);
    expect(fetchJson).toHaveBeenCalledTimes(1);
  });
});

describe("snapshot con metadata de índice", () => {
  it("congela rateMetadata al aplicar tasa sugerida", () => {
    const apiResult: EconomicIndexApiResponse = {
      available: true,
      countryCode: "AR",
      type: "interest_rate",
      sourceLabel: "IPC Argentina - datos.gob.ar",
      queriedAt: "2026-06-24T12:00:00.000Z",
      latestPeriod: "2026-05-01",
      suggestedAnnualRate: 42.5,
      suggestedMonthlyRate: 3.1,
      method: "inflation_proxy",
      message: "Referencia basada en inflación histórica, no tasa bancaria.",
    };

    const metadata = economicIndexMetadataFromApiResponse(apiResult);
    const snapshot = buildPaymentOptionsSnapshot({
      basePrice: 1_000_000,
      currency: "ARS",
      countryCode: "AR",
      calculatedAt: "2026-06-24T12:00:00.000Z",
      paymentOptions: {
        ...INITIAL_CUANTO_COBRO_PAYMENT_OPTIONS,
        installmentPlans: [
          {
            ...createEmptyInstallmentPlan(),
            numberOfInstallments: "6",
            interestMode: "index_suggested",
            interestPercent: "42.5",
            appliedIndexMetadata: metadata,
          },
        ],
      },
    });

    const plan = snapshot.installmentPlans[0];
    expect(plan?.rateSource).toBe("index");
    expect(plan?.rateMetadata?.sourceLabel).toBe("IPC Argentina - datos.gob.ar");
    expect(plan?.rateMetadata?.method).toBe("inflation_proxy");
    expect(plan?.rateMetadata?.latestPeriod).toBe("2026-05-01");
    expect(plan?.rateMetadata?.queriedAt).toBe("2026-06-24T12:00:00.000Z");
    expect(plan?.interestPercent).toBe(42.5);
  });

  it("mapea metadata desde resultado de proveedor", () => {
    const result: EconomicDataInterestRateResult = {
      available: true,
      countryCode: "AR",
      type: "interest_rate",
      sourceLabel: "BCRA - BADLAR",
      queriedAt: "2026-06-24T12:00:00.000Z",
      suggestedAnnualRate: 21.25,
      method: "bcra_badlar",
      latestPeriod: "2026-06-25",
    };

    const metadata = economicIndexMetadataFromApiResult(result);
    expect(metadata.suggestedPercent).toBe(21.25);
    expect(metadata.method).toBe("bcra_badlar");
    expect(metadata.countryCode).toBe("AR");
  });
});
