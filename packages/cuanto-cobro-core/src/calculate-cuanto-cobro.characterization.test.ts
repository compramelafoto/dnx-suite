/**
 * Caracterización del orquestador `calculateCuantoCobro`.
 * Congela el comportamiento actual — no corrige fórmulas ni defaults.
 *
 * Deuda observada (documentada, no corregida):
 * - `minimumSustainablePrice` = Math.round(recommendedPrice) del trabajo (con márgenes de ítem),
 *   no un piso de costo puro separado.
 * - `recommendedBusinessPrice` aplica el factor comercial sobre ese mínimo.
 * - Posicionamiento ausente/desconocido cae en `stable` (factor 1.25).
 */
import { describe, expect, it } from "vitest";
import {
  calculateCuantoCobro,
  getCuantoCobroMissingFields,
} from "./calculate-cuanto-cobro.js";
import { createEmptyQuoteItem } from "./quote-items.js";
import {
  createBaseCompleteProfile,
  createBaseCompleteQuote,
  createLongJobQuote,
  createMultiConceptQuote,
  createOwnServiceConcept,
  withCommercialPositioning,
  withConfiguredCamera,
  withEmptyEquipment,
  withHighExternalIncome,
  withWeeklyHours,
  withZeroBusinessAndReserves,
  withZeroPersonalExpenses,
} from "./__fixtures__/characterization-fixtures.js";

/** Golden — perfil base + trabajo base (valores sintéticos). */
const GOLDEN_BASE = {
  monthlyNeed: 320_000,
  hourlyRate: 1847.5750577367207,
  humanCost: 72056.90069284066,
  variableCosts: 5_000,
  recommendedPrice: 82490.90069284066,
  minimumSustainablePrice: 82_491,
  recommendedBusinessPrice: 103_114,
  commercialPositioningId: "stable" as const,
  equipmentSavingsMonthly: 20_000,
};

/** Golden — mismo perfil + trabajo largo. */
const GOLDEN_LONG = {
  monthlyNeed: 320_000,
  humanCost: 60971.801385681305,
  variableCosts: 15_000,
  recommendedPrice: 90806.8013856813,
  minimumSustainablePrice: 90_807,
  recommendedBusinessPrice: 113_509,
};

/** Golden — perfil base + high-demand (factor 2). */
const GOLDEN_HIGH_DEMAND = {
  minimumSustainablePrice: 82_491,
  recommendedBusinessPrice: 164_982,
  commercialPositioningId: "high-demand" as const,
};

describe("calculateCuantoCobro — caracterización orquestador", () => {
  describe("caso base completo (golden 1)", () => {
    it("devuelve complete con campos críticos estables", () => {
      const result = calculateCuantoCobro(
        createBaseCompleteProfile(),
        createBaseCompleteQuote(),
      );

      expect(result.status).toBe("complete");
      if (result.status !== "complete") return;

      expect(result.currency).toBe("ARS");
      expect(result.monthlyNeed).toBe(GOLDEN_BASE.monthlyNeed);
      expect(result.hourlyRate).toBe(GOLDEN_BASE.hourlyRate);
      expect(result.humanCost).toBe(GOLDEN_BASE.humanCost);
      expect(result.variableCosts).toBe(GOLDEN_BASE.variableCosts);
      expect(result.recommendedPrice).toBe(GOLDEN_BASE.recommendedPrice);
      expect(result.minimumSustainablePrice).toBe(GOLDEN_BASE.minimumSustainablePrice);
      expect(result.recommendedBusinessPrice).toBe(GOLDEN_BASE.recommendedBusinessPrice);
      expect(result.commercialPositioningId).toBe(GOLDEN_BASE.commercialPositioningId);
      expect(result.commercialPositioningLabel).toBeTruthy();
      expect(Array.isArray(result.warnings)).toBe(true);
      expect(result.clientSummary).toBeTruthy();
      expect(result.quoteSummary).toBeTruthy();
      expect(result.equipmentSavings.totalMonthly).toBe(GOLDEN_BASE.equipmentSavingsMonthly);
      expect(result.cameraWear).toBeNull();
    });
  });

  describe("golden 2 — trabajo largo", () => {
    it("recalcula costos y precios con más horas", () => {
      const result = calculateCuantoCobro(createBaseCompleteProfile(), createLongJobQuote());
      expect(result.status).toBe("complete");
      if (result.status !== "complete") return;

      expect(result.monthlyNeed).toBe(GOLDEN_LONG.monthlyNeed);
      expect(result.humanCost).toBe(GOLDEN_LONG.humanCost);
      expect(result.variableCosts).toBe(GOLDEN_LONG.variableCosts);
      expect(result.recommendedPrice).toBe(GOLDEN_LONG.recommendedPrice);
      expect(result.minimumSustainablePrice).toBe(GOLDEN_LONG.minimumSustainablePrice);
      expect(result.recommendedBusinessPrice).toBe(GOLDEN_LONG.recommendedBusinessPrice);
      expect(result.minimumSustainablePrice).toBeGreaterThan(GOLDEN_BASE.minimumSustainablePrice);
    });
  });

  describe("golden 3 — posicionamiento alto", () => {
    it("duplica el mínimo con factor 2 (salvo redondeo ya aplicado al mínimo)", () => {
      const result = calculateCuantoCobro(
        withCommercialPositioning(createBaseCompleteProfile(), "high-demand"),
        createBaseCompleteQuote(),
      );
      expect(result.status).toBe("complete");
      if (result.status !== "complete") return;

      expect(result.minimumSustainablePrice).toBe(GOLDEN_HIGH_DEMAND.minimumSustainablePrice);
      expect(result.recommendedBusinessPrice).toBe(GOLDEN_HIGH_DEMAND.recommendedBusinessPrice);
      expect(result.commercialPositioningId).toBe(GOLDEN_HIGH_DEMAND.commercialPositioningId);
      expect(result.recommendedBusinessPrice).toBe(
        result.minimumSustainablePrice * 2,
      );
    });
  });

  describe("factores comerciales", () => {
    const cases: Array<{
      id: "" | "starting" | "growing" | "stable" | "established" | "high-demand";
      expectedBusiness: number;
      effectiveId: "starting" | "growing" | "stable" | "established" | "high-demand";
    }> = [
      { id: "starting", expectedBusiness: 82_491, effectiveId: "starting" },
      { id: "growing", expectedBusiness: 90_740, effectiveId: "growing" },
      { id: "stable", expectedBusiness: 103_114, effectiveId: "stable" },
      { id: "established", expectedBusiness: 123_737, effectiveId: "established" },
      { id: "high-demand", expectedBusiness: 164_982, effectiveId: "high-demand" },
      { id: "", expectedBusiness: 103_114, effectiveId: "stable" },
    ];

    for (const { id, expectedBusiness, effectiveId } of cases) {
      it(`posicionamiento ${id === "" ? "(ausente → default stable)" : id}`, () => {
        const result = calculateCuantoCobro(
          withCommercialPositioning(createBaseCompleteProfile(), id),
          createBaseCompleteQuote(),
        );
        expect(result.status).toBe("complete");
        if (result.status !== "complete") return;

        expect(result.minimumSustainablePrice).toBe(GOLDEN_BASE.minimumSustainablePrice);
        expect(result.recommendedBusinessPrice).toBe(expectedBusiness);
        expect(result.recommendedBusinessPrice).toBeGreaterThanOrEqual(
          result.minimumSustainablePrice,
        );
        expect(result.commercialPositioningId).toBe(effectiveId);
      });
    }

    it("factor 1 (starting) iguala mínimo y recomendado de negocio", () => {
      const result = calculateCuantoCobro(
        withCommercialPositioning(createBaseCompleteProfile(), "starting"),
        createBaseCompleteQuote(),
      );
      expect(result.status).toBe("complete");
      if (result.status !== "complete") return;
      expect(result.recommendedBusinessPrice).toBe(result.minimumSustainablePrice);
    });
  });

  describe("horas y división por cero", () => {
    it("horas semanales válidas producen complete", () => {
      const result = calculateCuantoCobro(
        withWeeklyHours(createBaseCompleteProfile(), "40"),
        createBaseCompleteQuote(),
      );
      expect(result.status).toBe("complete");
    });

    it("horas semanales en cero → incomplete", () => {
      const result = calculateCuantoCobro(
        withWeeklyHours(createBaseCompleteProfile(), "0"),
        createBaseCompleteQuote(),
      );
      expect(result.status).toBe("incomplete");
      if (result.status !== "incomplete") return;
      expect(result.missingFields).toEqual(
        expect.arrayContaining([
          "Horas semanales dedicadas a tu actividad fotográfica",
        ]),
      );
    });

    it("cobertura semanal 0 en distribución → incomplete", () => {
      const profile = createBaseCompleteProfile({
        timeDistribution: {
          coverage: "0",
          editing: "40",
          administration: "20",
          sales: "20",
          marketing: "10",
          training: "10",
        },
      });
      const result = calculateCuantoCobro(profile, createBaseCompleteQuote());
      expect(result.status).toBe("incomplete");
      if (result.status !== "incomplete") return;
      expect(result.missingFields).toContain(
        "Asigná al menos 1 hora semanal a Coberturas fotográficas",
      );
    });

    it("concepto sin horas ni costo directo → incomplete", () => {
      const result = calculateCuantoCobro(
        createBaseCompleteProfile(),
        createBaseCompleteQuote({
          concepts: [
            createOwnServiceConcept({
              coverageHours: "0",
              editingHours: "0",
              deliveryHours: "0",
              travelHours: "0",
              directCost: "0",
            }),
          ],
        }),
      );
      expect(result.status).toBe("incomplete");
      if (result.status !== "incomplete") return;
      expect(result.missingFields.some((f) => f.includes("Horas o costo directo"))).toBe(
        true,
      );
    });

    it("duración de cobertura alta pero válida sigue complete", () => {
      const result = calculateCuantoCobro(
        createBaseCompleteProfile(),
        createBaseCompleteQuote({
          concepts: [
            createOwnServiceConcept({
              coverageHours: "24",
              editingHours: "12",
            }),
          ],
        }),
      );
      expect(result.status).toBe("complete");
      if (result.status !== "complete") return;
      expect(result.recommendedBusinessPrice).toBeGreaterThan(
        GOLDEN_BASE.recommendedBusinessPrice,
      );
    });
  });

  describe("gastos e ingresos", () => {
    it("gastos personales en cero → incomplete (regla actual del perfil)", () => {
      const result = calculateCuantoCobro(
        withZeroPersonalExpenses(createBaseCompleteProfile()),
        createBaseCompleteQuote(),
      );
      expect(result.status).toBe("incomplete");
      if (result.status !== "incomplete") return;
      expect(result.missingFields).toContain(
        "Al menos un gasto personal con monto mayor a 0",
      );
    });

    it("gastos de negocio y reservas en cero: monthlyNeed solo personales", () => {
      const result = calculateCuantoCobro(
        withZeroBusinessAndReserves(createBaseCompleteProfile()),
        createBaseCompleteQuote(),
      );
      expect(result.status).toBe("complete");
      if (result.status !== "complete") return;
      expect(result.monthlyNeed).toBe(200_000);
      expect(result.monthlyNeed).toBeGreaterThanOrEqual(0);
      expect(result.minimumSustainablePrice).toBe(53_808);
      expect(result.recommendedBusinessPrice).toBe(67_260);
    });

    it("ingresos externos altos: monthlyNeed = 0 (max) y warnings", () => {
      const result = calculateCuantoCobro(
        withHighExternalIncome(createBaseCompleteProfile()),
        createBaseCompleteQuote(),
      );
      expect(result.status).toBe("complete");
      if (result.status !== "complete") return;
      expect(result.monthlyNeed).toBe(0);
      expect(result.hourlyRate).toBe(0);
      expect(result.minimumSustainablePrice).toBe(6_000);
      expect(result.recommendedBusinessPrice).toBe(7_500);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(
        result.warnings.some((w) => w.includes("ingresos externos")),
      ).toBe(true);
    });
  });

  describe("equipo", () => {
    it("inventario vacío y renovación 0 reduce equipmentSavings y precios", () => {
      const result = calculateCuantoCobro(
        withEmptyEquipment(createBaseCompleteProfile()),
        createBaseCompleteQuote(),
      );
      expect(result.status).toBe("complete");
      if (result.status !== "complete") return;
      expect(result.equipmentSavings.totalMonthly).toBe(0);
      expect(result.cameraWear).toBeNull();
      expect(result.monthlyNeed).toBe(300_000);
      expect(result.minimumSustainablePrice).toBe(77_711);
      expect(result.recommendedBusinessPrice).toBe(97_139);
    });

    it("cámara configurada puede poblar cameraWear sin romper complete", () => {
      const result = calculateCuantoCobro(
        withConfiguredCamera(createBaseCompleteProfile()),
        createBaseCompleteQuote({
          concepts: [createOwnServiceConcept({ estimatedShots: "800" })],
        }),
      );
      expect(result.status).toBe("complete");
      if (result.status !== "complete") return;
      expect(result.cameraWear === null || result.cameraWear.isConfigured).toBe(true);
      expect(result.cameraWearSummary.isCameraConfigured).toBe(true);
    });
  });

  describe("ítems y horas generales", () => {
    it("múltiples conceptos (propio + tercerizado + gasto) completan", () => {
      const result = calculateCuantoCobro(
        createBaseCompleteProfile(),
        createMultiConceptQuote(),
      );
      expect(result.status).toBe("complete");
      if (result.status !== "complete") return;
      expect(result.quoteSummary.items).toHaveLength(3);
      expect(result.variableCosts).toBeGreaterThan(GOLDEN_BASE.variableCosts);
      expect(result.recommendedBusinessPrice).toBeGreaterThan(
        GOLDEN_BASE.recommendedBusinessPrice,
      );
      expect(result.humanCost).toBeGreaterThan(0);
    });

    it("horas generales del cliente forman parte del humanCost", () => {
      const withClientHours = calculateCuantoCobro(
        createBaseCompleteProfile(),
        createBaseCompleteQuote(),
      );
      const withoutClientHours = calculateCuantoCobro(
        createBaseCompleteProfile(),
        createBaseCompleteQuote({
          client: {
            ...createBaseCompleteQuote().client,
            hours: {
              salesHours: "0",
              meetingsHours: "0",
              generalPrepHours: "0",
              coordinationHours: "0",
              billingHours: "0",
              followUpHours: "0",
              administrativeDeliveryHours: "0",
            },
          },
        }),
      );
      expect(withClientHours.status).toBe("complete");
      expect(withoutClientHours.status).toBe("complete");
      if (withClientHours.status !== "complete" || withoutClientHours.status !== "complete") {
        return;
      }
      expect(withClientHours.humanCost).toBeGreaterThan(withoutClientHours.humanCost);
      expect(withClientHours.clientSummary.totalHours).toBeGreaterThan(
        withoutClientHours.clientSummary.totalHours,
      );
    });
  });

  describe("redondeos", () => {
    it("minimumSustainablePrice es entero (Math.round del recommendedPrice interno)", () => {
      const result = calculateCuantoCobro(
        createBaseCompleteProfile(),
        createBaseCompleteQuote(),
      );
      expect(result.status).toBe("complete");
      if (result.status !== "complete") return;

      expect(Number.isInteger(result.minimumSustainablePrice)).toBe(true);
      expect(Number.isInteger(result.recommendedBusinessPrice)).toBe(true);
      expect(result.minimumSustainablePrice).toBe(Math.round(result.recommendedPrice));
      // hourlyRate y humanCost pueden conservar decimales
      expect(Number.isInteger(result.hourlyRate)).toBe(false);
      expect(Number.isInteger(result.humanCost)).toBe(false);
    });

    it("decimales en horas: redondeo de precios de negocio documentado", () => {
      const result = calculateCuantoCobro(
        createBaseCompleteProfile(),
        createBaseCompleteQuote({
          concepts: [
            createOwnServiceConcept({
              coverageHours: "3.3",
              editingHours: "2.7",
              desiredMarginPercent: "17",
              directCost: "3333",
            }),
          ],
        }),
      );
      expect(result.status).toBe("complete");
      if (result.status !== "complete") return;
      expect(result.minimumSustainablePrice).toBe(187_809);
      expect(result.recommendedBusinessPrice).toBe(234_761);
      expect(result.recommendedBusinessPrice).toBe(
        Math.round(result.minimumSustainablePrice * 1.25),
      );
    });
  });

  describe("entrada incompleta", () => {
    it("sin moneda → incomplete", () => {
      const result = calculateCuantoCobro(
        createBaseCompleteProfile({ currency: "" }),
        createBaseCompleteQuote(),
      );
      expect(result.status).toBe("incomplete");
      if (result.status !== "incomplete") return;
      expect(result.missingFields).toContain("Moneda principal");
    });

    it("sin tipo de trabajo → incomplete", () => {
      const quote = createBaseCompleteQuote();
      const result = calculateCuantoCobro(createBaseCompleteProfile(), {
        ...quote,
        client: { ...quote.client, jobType: "" },
      });
      expect(result.status).toBe("incomplete");
      if (result.status !== "incomplete") return;
      expect(result.missingFields).toEqual(["Tipo de trabajo"]);
    });

    it("sin conceptos → incomplete", () => {
      const result = calculateCuantoCobro(
        createBaseCompleteProfile(),
        createBaseCompleteQuote({ concepts: [] }),
      );
      expect(result.status).toBe("incomplete");
      if (result.status !== "incomplete") return;
      expect(result.missingFields).toContain(
        "Al menos un producto o servicio en el presupuesto",
      );
    });

    it("posicionamiento comercial no es obligatorio en missingFields del perfil", () => {
      const missing = getCuantoCobroMissingFields(
        "commercial-positioning",
        createBaseCompleteProfile({ commercialPositioningId: "" }),
        createBaseCompleteQuote(),
      );
      expect(missing).toEqual([]);
    });

    it("producto físico sin costos → incomplete", () => {
      const result = calculateCuantoCobro(
        createBaseCompleteProfile(),
        createBaseCompleteQuote({
          concepts: [
            createEmptyQuoteItem({
              id: "qi-product-empty",
              name: "Producto sintético vacío",
              itemType: "physical-product",
              quantity: "1",
            }),
          ],
        }),
      );
      expect(result.status).toBe("incomplete");
      if (result.status !== "incomplete") return;
      expect(
        result.missingFields.some((f) => f.includes("Costos u horas de diseño")),
      ).toBe(true);
    });
  });
});
