import { describe, expect, it } from "vitest";
import { createBaseCompleteQuote, createOwnServiceConcept } from "./__fixtures__/characterization-fixtures";
import { normalizeQuoteHoursForCalculation } from "./normalize-quote-hours";

const SIN_CLIENTE = {
  salesHours: "0",
  meetingsHours: "0",
  generalPrepHours: "0",
  coordinationHours: "0",
  billingHours: "0",
  followUpHours: "0",
  administrativeDeliveryHours: "0",
};

function cotizacion(deliveryHours: string, entregaAsignada: string | null) {
  return createBaseCompleteQuote({
    client: { ...createBaseCompleteQuote().client, hours: SIN_CLIENTE },
    concepts: [
      createOwnServiceConcept({
        name: "Sesión",
        coverageHours: "4",
        salesHours: "2",
        deliveryHours,
        assignments: [
          { personId: "owner", activity: "coverage", hours: "4" },
          ...(entregaAsignada === null ? [] : [{ personId: "owner", activity: "delivery" as const, hours: entregaAsignada }]),
        ],
      }),
    ],
  });
}

describe("normalizeQuoteHoursForCalculation: entrega con horas comerciales", () => {
  it("mueve la entrega al cliente, quita su asignación y lo dice en el aviso", () => {
    const r = normalizeQuoteHoursForCalculation(cotizacion("1", "1"));
    expect(r.quote.client.hours.administrativeDeliveryHours).toBe("1");
    expect(r.quote.concepts[0]!.deliveryHours).toBe("");
    expect(r.quote.concepts[0]!.assignments).toEqual([{ personId: "owner", activity: "coverage", hours: "4" }]);
    const aviso = r.warnings.find((w) => w.includes("entrega"))!;
    expect(aviso).toMatch(/asignación de la entrega/);
  });

  it("sin horas de entrega en la línea no mueve nada y deja intacta la asignación de entrega", () => {
    const r = normalizeQuoteHoursForCalculation(cotizacion("", "2"));
    expect(r.quote.client.hours.administrativeDeliveryHours).toBe("0");
    expect(r.quote.concepts[0]!.assignments?.some((a) => a.activity === "delivery" && a.hours === "2")).toBe(true);
    expect(r.warnings.some((w) => w.includes("de entrega"))).toBe(false);
  });

  it("sin asignación de entrega el aviso no habla de asignaciones", () => {
    const r = normalizeQuoteHoursForCalculation(cotizacion("2", null));
    expect(r.quote.client.hours.administrativeDeliveryHours).toBe("2");
    expect(r.warnings.find((w) => w.includes("entrega"))).not.toMatch(/asignación/);
  });
});
