import { PDFDocument } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";

vi.mock("../normalize-quote", () => ({
  normalizeCuantoCobroQuote: (quote: unknown) => quote,
}));

vi.mock("@/lib/cuantocobro/types", async () => import("../types"));

vi.mock("../calculate-cuanto-cobro", () => ({
  formatCuantoCobroCurrency: (amount: number, currency = "ARS") =>
    amount.toLocaleString("es-AR", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }),
}));

vi.mock("@/lib/photographer/perfil-datos-utils", () => ({
  joinTitularName: (first: string, last: string) => `${first} ${last}`.trim(),
  pickContactPhone: (...phones: string[]) => phones.find(Boolean) ?? "",
  splitTitularName: (name: string) => {
    const parts = name.trim().split(/\s+/);
    return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
  },
}));

vi.mock("@/lib/cuantocobro/storage/get-cuanto-cobro-storage", () => ({
  getCuantoCobroStorage: () => ({
    getItem: vi.fn(),
    setItem: vi.fn(),
  }),
}));

import { commercialProposalModelExposesInternalData } from "../commercial-proposal";
import { CUANTO_COBRO_PAYMENT_OPTIONS_SNAPSHOT_VERSION } from "../payment/payment-options-types";
import {
  assertPremiumQuotePdfHasNoInternalExposure,
  buildQuotePdfFromFrozenSnapshot,
} from "./build-quote-pdf";
import type { FrozenQuoteCommercialSnapshot } from "./quote-commercial-snapshot";

function buildTestSnapshot(overrides: Partial<FrozenQuoteCommercialSnapshot> = {}): FrozenQuoteCommercialSnapshot {
  return {
    quoteNumber: "CC-2026-0099",
    versionNumber: 2,
    quote: {
      client: {
        name: "Carina",
        company: "Dnxfotografia",
        email: "cliente@example.com",
        phone: "+54 341 000 0000",
        jobType: "boda",
        jobDate: "2026-07-04",
        jobLocation: "Funes, Santa Fe",
      },
      commercialDisplayMode: "detailed",
      commercialNote: "Válida por 15 días.\nSeña del 30% para reservar fecha.",
      chosenPrice: "919510",
      paymentOptions: {
        cashEnabled: true,
        cashDiscountPercent: "10",
        cashCommercialNote: "",
        installmentPlans: [
          {
            id: "plan-1",
            numberOfInstallments: "3",
            interestMode: "none",
            interestPercent: "",
            commercialNote: "Cuotas mensuales",
          },
        ],
      },
      concepts: [
        {
          id: "c1",
          name: "Cobertura fotográfica completa",
          description: "Ceremonia y fiesta con entrega digital",
          itemType: "own-service",
          quantity: "1",
          coverageHours: "8",
          editingHours: "12",
          selectionHours: "",
          deliveryHours: "",
          travelHours: "",
          administrationHours: "",
          salesHours: "",
          directCost: "",
          estimatedShots: "",
          supplierCost: "",
          productionHours: "",
          reviewHours: "",
          correctionHours: "",
          packagingCost: "",
          shippingCost: "",
          outsourcedLaborCost: "",
          expenseCost: "",
          desiredMarginPercent: "",
        },
      ],
    },
    calculation: {
      status: "complete",
      currency: "ARS",
      recommendedBusinessPrice: 919510,
      minimumSustainablePrice: 750000,
      chosenPriceEffective: 919510,
      hourlyRate: 45000,
      monthlyNeed: 1200000,
      estimatedMargin: 169510,
      profitabilityStatus: "profitable",
    },
    paymentOptionsSnapshot: {
      schemaVersion: CUANTO_COBRO_PAYMENT_OPTIONS_SNAPSHOT_VERSION,
      basePrice: 919510,
      currency: "ARS",
      countryCode: "AR",
      calculatedAt: "2026-06-24T12:00:00.000Z",
      cash: {
        enabled: true,
        discountPercent: 10,
        basePrice: 919510,
        cashPrice: 827559,
        commercialNote: "Descuento por pago en un solo pago",
      },
      installmentPlans: [
        {
          id: "plan-1",
          numberOfInstallments: 3,
          interestMode: "none",
          interestPercent: 0,
          financedTotal: 919510,
          installmentAmount: 306503,
          commercialNote: "Cuotas mensuales",
          rateSource: "none",
          rateMetadata: null,
        },
      ],
    },
    businessProfile: {
      tradeName: "DnX Fotografía",
      photographerFirstName: "Daniel",
      photographerLastName: "Cuart",
      commercialEmail: "hola@dnx.com",
      phone: "+54 341 374 8324",
      website: "https://dnx.com",
      instagram: "@dnxfoto",
      cuit: "",
      taxCondition: "",
      country: "AR",
      province: "",
      city: "Rosario",
      address: "",
      postalCode: "",
      latitude: "",
      longitude: "",
      logoUrl: "",
      updatedAt: "",
    },
    ...overrides,
  };
}

describe("buildQuotePdfFromFrozenSnapshot", () => {
  it("genera PDF válido sin exponer campos internos en el modelo", async () => {
    const snapshot = buildTestSnapshot();
    const bytes = await buildQuotePdfFromFrozenSnapshot(snapshot);

    expect(bytes.byteLength).toBeGreaterThan(500);
    expect(() => assertPremiumQuotePdfHasNoInternalExposure(bytes)).not.toThrow();

    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("el modelo comercial usado no expone datos internos", async () => {
    const snapshot = buildTestSnapshot();
    const { buildCommercialProposalModel } = await import("../commercial-proposal");
    const model = buildCommercialProposalModel({
      quote: snapshot.quote,
      calculation: snapshot.calculation,
      businessProfile: snapshot.businessProfile,
      paymentOptionsSnapshot: snapshot.paymentOptionsSnapshot,
      quoteNumber: snapshot.quoteNumber,
      versionNumber: snapshot.versionNumber,
    });

    expect(commercialProposalModelExposesInternalData(model)).toBe(false);
  });

  it("genera PDF aunque no haya logo", async () => {
    const bytes = await buildQuotePdfFromFrozenSnapshot(buildTestSnapshot());
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  it("genera PDF aunque el logo sea inválido", async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockRejectedValue(new Error("network")) as unknown as typeof fetch;

    try {
      const bytes = await buildQuotePdfFromFrozenSnapshot(
        buildTestSnapshot({
          businessProfile: {
            ...buildTestSnapshot().businessProfile!,
            logoUrl: "https://invalid.example/logo.png",
          },
        }),
      );
      expect(bytes.byteLength).toBeGreaterThan(0);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("genera PDF aunque el contacto use dominio compramelafoto.com", async () => {
    const bytes = await buildQuotePdfFromFrozenSnapshot(
      buildTestSnapshot({
        businessProfile: {
          ...buildTestSnapshot().businessProfile!,
          commercialEmail: "fotografo@compramelafoto.com",
          website: "https://www.compramelafoto.com/estudio",
        },
      }),
    );
    expect(bytes.byteLength).toBeGreaterThan(500);
  });

  it("genera PDF con logo real cuando hay logoUrl", async () => {
    const baseProfile = buildTestSnapshot().businessProfile!;
    const bytes = await buildQuotePdfFromFrozenSnapshot(
      buildTestSnapshot({
        businessProfile: {
          ...baseProfile,
          logoUrl: "https://cdn.example/studio-logo.png",
        },
      }),
    );

    expect(bytes.byteLength).toBeGreaterThan(500);
    expect(() => assertPremiumQuotePdfHasNoInternalExposure(bytes)).not.toThrow();
  });

  it("genera PDF con color de marca del fotógrafo en snapshot", async () => {
    const baseProfile = buildTestSnapshot().businessProfile!;
    const bytes = await buildQuotePdfFromFrozenSnapshot(
      buildTestSnapshot({
        businessProfile: {
          ...baseProfile,
          primaryColor: "#c27b3d",
        } as typeof baseProfile & { primaryColor: string },
      }),
    );

    expect(bytes.byteLength).toBeGreaterThan(500);
    expect(() => assertPremiumQuotePdfHasNoInternalExposure(bytes)).not.toThrow();
  });

  it("soporta muchos ítems y tarjetas largas en múltiples páginas", async () => {
    const base = buildTestSnapshot();
    const manyIncludes = Array.from({ length: 14 }, (_, index) => ({
      id: `c-${index}`,
      name: `Servicio profesional ${index + 1} con cobertura extendida`,
      description:
        "Incluye sesión, edición profesional, galería privada y asesoramiento personalizado para el día del evento.",
      itemType: "own-service" as const,
      quantity: "1",
      coverageHours: "4",
      editingHours: "6",
      selectionHours: "",
      deliveryHours: "",
      travelHours: "",
      administrationHours: "",
      salesHours: "",
      directCost: "",
      estimatedShots: "",
      supplierCost: "",
      productionHours: "",
      reviewHours: "",
      correctionHours: "",
      packagingCost: "",
      shippingCost: "",
      outsourcedLaborCost: "",
      expenseCost: "",
      desiredMarginPercent: "",
    }));

    const longNote =
      "Plan sujeto a disponibilidad de calendario. La reserva se confirma con la seña. " +
      "Las cuotas deben estar canceladas antes del evento según el cronograma acordado.";

    const bytes = await buildQuotePdfFromFrozenSnapshot(
      buildTestSnapshot({
        quote: { ...base.quote, concepts: manyIncludes },
        paymentOptionsSnapshot: {
          ...base.paymentOptionsSnapshot!,
          installmentPlans: [
            ...(base.paymentOptionsSnapshot?.installmentPlans ?? []),
            {
              id: "plan-long",
              numberOfInstallments: 6,
              interestMode: "manual" as const,
              interestPercent: 12,
              financedTotal: 1_030_000,
              installmentAmount: 171_667,
              commercialNote: longNote,
              rateSource: "manual" as const,
              rateMetadata: null,
            },
          ],
        },
      }),
    );

    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(1);
    expect(() => assertPremiumQuotePdfHasNoInternalExposure(bytes)).not.toThrow();
  });
});
