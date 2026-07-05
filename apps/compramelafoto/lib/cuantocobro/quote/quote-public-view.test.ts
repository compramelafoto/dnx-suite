import { describe, expect, it } from "vitest";
import {
  buildQuotePublicViewPayload,
  quotePublicPayloadExposesInternalData,
} from "./quote-public-view";
import type { QuotePublicViewDto } from "./quote-delivery-db";

function buildView(): QuotePublicViewDto {
  const calculation = {
    status: "complete",
    currency: "ARS",
    chosenPriceEffective: 150000,
    hourlyRate: 8500,
    minimumSustainablePrice: 120000,
    clientSummary: { suggestedPrice: 20000 },
    quoteSummary: { items: [] },
    variableCosts: 5000,
    profitabilityStatus: "profitable",
  };

  return {
    quoteNumber: "CC-2026-0009",
    versionNumber: 2,
    businessProfile: { tradeName: "Estudio", commercialEmail: "hola@estudio.com" } as QuotePublicViewDto["businessProfile"],
    snapshot: {
      quoteNumber: "CC-2026-0009",
      versionNumber: 2,
      quote: {
        client: {
          name: "Cliente",
          company: "",
          email: "cliente@example.com",
          phone: "",
          jobType: "evento",
          jobDate: "",
          jobLocation: "",
        },
        commercialDisplayMode: "total-only",
        commercialNote: "Seña 30%.",
        chosenPrice: "",
        paymentOptions: { cashEnabled: true, installmentPlans: [] },
        items: [],
      },
      calculation: calculation as QuotePublicViewDto["snapshot"]["calculation"],
      paymentOptionsSnapshot: { cash: { enabled: true, discountPercent: 0, commercialNote: "" }, installmentPlans: [] },
      businessProfile: { tradeName: "Estudio", commercialEmail: "hola@estudio.com" } as QuotePublicViewDto["businessProfile"],
    },
  };
}

describe("quote-public-view", () => {
  it("no expone datos internos en la vista pública", () => {
    const payload = buildQuotePublicViewPayload(buildView());

    expect(payload.calculation.chosenPriceEffective).toBe(150000);
    expect(payload.calculation.hourlyRate).toBeUndefined();
    expect(payload.calculation.minimumSustainablePrice).toBeUndefined();
    expect(payload.calculation.clientSummary).toBeUndefined();
    expect(quotePublicPayloadExposesInternalData(payload)).toBe(false);
  });
});
