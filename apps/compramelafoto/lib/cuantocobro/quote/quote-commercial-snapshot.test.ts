import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/photographer/perfil-datos-utils", () => ({
  joinTitularName: (first: string, last: string) => `${first} ${last}`.trim(),
  pickContactPhone: (...phones: string[]) => phones.find(Boolean) ?? "",
  splitTitularName: (name: string | null) => {
    const parts = (name || "").trim().split(/\s+/);
    return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
  },
}));

vi.mock("@/lib/cuantocobro/storage/get-cuanto-cobro-storage", () => ({
  getCuantoCobroStorage: () => ({
    getItem: vi.fn(),
    setItem: vi.fn(),
  }),
}));

vi.mock("../normalize-quote", () => ({
  normalizeCuantoCobroQuote: (quote: unknown) => quote,
}));

import {
  buildFrozenQuoteCommercialSnapshot,
  parseBusinessProfileSnapshot,
} from "./quote-commercial-snapshot";
import { stripInternalCalculationForPublic } from "./quote-internal-exposure";
import { CUANTO_COBRO_PAYMENT_OPTIONS_SNAPSHOT_VERSION } from "../payment/payment-options-types";

describe("quote-commercial-snapshot", () => {
  it("congela quote, cálculo, pagos y perfil comercial", () => {
    const snapshot = buildFrozenQuoteCommercialSnapshot({
      quoteNumber: "CC-2026-0010",
      versionNumber: 1,
      quotePayload: {
        client: {
          name: "Laura",
          company: "ACME",
          email: "laura@acme.com",
          phone: "11",
          jobType: "retrato",
          jobDate: "2026-10-10",
          jobLocation: "Palermo",
        },
        commercialDisplayMode: "detailed",
        commercialNote: "Incluye edición.",
        chosenPrice: "180000",
        paymentOptions: { cashEnabled: true, installmentPlans: [] },
        items: [],
      },
      calculationSnapshot: {
        status: "complete",
        currency: "ARS",
        recommendedBusinessPrice: 180000,
        minimumSustainablePrice: 150000,
        chosenPriceEffective: 180000,
      },
      paymentOptionsSnapshot: {
        schemaVersion: CUANTO_COBRO_PAYMENT_OPTIONS_SNAPSHOT_VERSION,
        basePrice: 180000,
        currency: "ARS",
        countryCode: "AR",
        cash: { enabled: true, discountPercent: 0, commercialNote: "" },
        installmentPlans: [],
      },
      businessProfileSnapshot: {
        tradeName: "Foto LC",
        commercialEmail: "hola@fotolc.com",
      },
    });

    expect(snapshot?.quote.client.name).toBe("Laura");
    expect(snapshot?.calculation.chosenPriceEffective).toBe(180000);
    expect(snapshot?.businessProfile?.tradeName).toBe("Foto LC");
    expect(snapshot?.paymentOptionsSnapshot.cash?.enabled).toBe(true);
  });

  it("mantiene cálculo congelado para PDF sin recalcular desde perfil actual", () => {
    const snapshot = buildFrozenQuoteCommercialSnapshot({
      quoteNumber: "CC-2026-0011",
      versionNumber: 3,
      quotePayload: { client: { name: "Test", company: "", email: "", phone: "", jobType: "", jobDate: "", jobLocation: "" }, commercialDisplayMode: "total-only", commercialNote: "", chosenPrice: "", paymentOptions: { cashEnabled: false, installmentPlans: [] }, items: [] },
      calculationSnapshot: {
        status: "complete",
        currency: "ARS",
        recommendedBusinessPrice: 200000,
        minimumSustainablePrice: 160000,
        chosenPriceEffective: 200000,
        hourlyRate: 99999,
      },
      paymentOptionsSnapshot: {},
      businessProfileSnapshot: {},
    });

    expect(snapshot?.calculation.hourlyRate).toBe(99999);
    expect(snapshot?.calculation.chosenPriceEffective).toBe(200000);
  });

  it("parsea perfil comercial mínimo", () => {
    expect(parseBusinessProfileSnapshot({ tradeName: "Demo" })?.tradeName).toBe("Demo");
    expect(parseBusinessProfileSnapshot(null)).toBeNull();
  });

  it("elimina campos internos del cálculo público", () => {
    const stripped = stripInternalCalculationForPublic({
      chosenPriceEffective: 100,
      hourlyRate: 50,
      clientSummary: { suggestedPrice: 10 },
    });
    expect(stripped.chosenPriceEffective).toBe(100);
    expect(stripped.hourlyRate).toBeUndefined();
    expect(stripped.clientSummary).toBeUndefined();
  });
});
