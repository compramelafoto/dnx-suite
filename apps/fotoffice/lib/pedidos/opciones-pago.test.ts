import { INITIAL_CUANTO_COBRO_PAYMENT_OPTIONS } from "@repo/cuanto-cobro-core";
import { describe, expect, it } from "vitest";
import {
  buildPaymentOptionsSnapshot,
  buscarOpcion,
  calculateCashPrice,
  calculateFinancedTotal,
  calculateInstallmentAmount,
  createEmptyInstallmentPlan,
  cuotasPorOmision,
  normalizePaymentOptions,
  opcionesDeInstantanea,
  opcionesParaPresupuesto,
  opcionPorOmision,
  parsePaymentOptionsSnapshot,
} from "./opciones-pago";
import { planDesdeOpcion } from "./plan-cuotas";

const EN = "2026-10-08T12:00:00.000Z";

// Los mismos casos que `apps/compramelafoto/lib/cuantocobro/payment/payment-options.test.ts`.
describe("igual a ¿Cuánto Cobro?", () => {
  it("calculateCashPrice aplica descuento porcentual sobre el precio base", () => {
    expect(calculateCashPrice(1_000_000, 10)).toBe(900_000);
    expect(calculateCashPrice(500_000, 0)).toBe(500_000);
  });

  it("calculateFinancedTotal sin interés y con interés manual", () => {
    expect(calculateFinancedTotal(1_000_000, 0)).toBe(1_000_000);
    expect(calculateFinancedTotal(1_000_000, 15)).toBe(1_150_000);
  });

  it("calculateInstallmentAmount: la parte pareja a centavos (¿Cuánto Cobro? redondea a pesos)", () => {
    // ¿Cuánto Cobro? da 333_333 y 383_333: acá van con centavos, como la cuota real del plan.
    expect(calculateInstallmentAmount(1_000_000, 3)).toBe(333_333.33);
    expect(calculateInstallmentAmount(1_150_000, 3)).toBe(383_333.33);
    expect(calculateInstallmentAmount(0, 3)).toBe(0);
  });

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
          { ...createEmptyInstallmentPlan(), numberOfInstallments: "3", interestMode: "manual", interestPercent: "15" },
        ],
      },
    });

    expect(snapshot.basePrice).toBe(1_000_000);
    expect(snapshot.cash?.cashPrice).toBe(900_000);
    expect(snapshot.installmentPlans[0]?.financedTotal).toBe(1_150_000);
    expect(snapshot.calculatedAt).toBe("2026-06-24T12:00:00.000Z");
  });

  it("re-parsea la instantánea congelada sin recalcular", () => {
    const snapshot = buildPaymentOptionsSnapshot({
      basePrice: 800_000,
      paymentOptions: { ...INITIAL_CUANTO_COBRO_PAYMENT_OPTIONS, cashEnabled: true, cashDiscountPercent: "5" },
    });
    const parsed = parsePaymentOptionsSnapshot(JSON.parse(JSON.stringify(snapshot)));
    expect(parsed?.cash?.cashPrice).toBe(760_000);
    expect(parsed?.basePrice).toBe(800_000);
    expect(parsed?.currency).toBe("ARS");
  });

  it("congela la tasa del índice aplicada (sin consultar la red)", () => {
    const snapshot = buildPaymentOptionsSnapshot({
      basePrice: 1_000_000,
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
    expect(snapshot.installmentPlans[0]?.financedTotal).toBe(1_212_500);
  });

  it("index_suggested sin índice congelado usa la tasa guardada como manual", () => {
    const snapshot = buildPaymentOptionsSnapshot({
      basePrice: 100_000,
      paymentOptions: {
        ...INITIAL_CUANTO_COBRO_PAYMENT_OPTIONS,
        cashEnabled: false,
        installmentPlans: [
          { ...createEmptyInstallmentPlan(), numberOfInstallments: "2", interestMode: "index_suggested", interestPercent: "10" },
        ],
      },
    });
    expect(snapshot.installmentPlans[0]).toMatchObject({ rateSource: "manual", interestPercent: 10, financedTotal: 110_000 });
  });

  it("descarta planes sin cantidad de cuotas y no ofrece contado con precio cero", () => {
    const snapshot = buildPaymentOptionsSnapshot({
      basePrice: 0,
      paymentOptions: {
        ...INITIAL_CUANTO_COBRO_PAYMENT_OPTIONS,
        installmentPlans: [{ ...createEmptyInstallmentPlan(), numberOfInstallments: "" }],
      },
    });
    expect(snapshot.cash).toBeNull();
    expect(snapshot.installmentPlans).toEqual([]);
  });

  it("conserva los centavos del total", () => {
    const snapshot = buildPaymentOptionsSnapshot({
      basePrice: 100_000.5,
      paymentOptions: {
        ...INITIAL_CUANTO_COBRO_PAYMENT_OPTIONS,
        installmentPlans: [{ ...createEmptyInstallmentPlan(), numberOfInstallments: "3" }],
      },
    });
    expect(snapshot.basePrice).toBe(100_000.5);
    expect(snapshot.cash?.cashPrice).toBe(100_000.5);
    expect(snapshot.installmentPlans[0]?.financedTotal).toBe(100_000.5);
  });
});

describe("parsePaymentOptionsSnapshot", () => {
  it("rechaza lo que no es una instantánea", () => {
    expect(parsePaymentOptionsSnapshot(null)).toBeNull();
    expect(parsePaymentOptionsSnapshot([])).toBeNull();
    expect(parsePaymentOptionsSnapshot({ schemaVersion: 2, basePrice: 1, installmentPlans: [] })).toBeNull();
    expect(parsePaymentOptionsSnapshot({ schemaVersion: 1, basePrice: "1", installmentPlans: [] })).toBeNull();
    expect(parsePaymentOptionsSnapshot({ schemaVersion: 1, basePrice: 1 })).toBeNull();
  });
});

describe("normalizePaymentOptions", () => {
  it("sin datos devuelve los valores iniciales de ¿Cuánto Cobro?", () => {
    expect(normalizePaymentOptions(null)).toEqual({ ...INITIAL_CUANTO_COBRO_PAYMENT_OPTIONS, installmentPlans: [] });
  });

  it("limpia planes inválidos y modos desconocidos", () => {
    const r = normalizePaymentOptions({
      cashEnabled: false,
      installmentPlans: [
        null,
        { id: "p1", numberOfInstallments: "3", interestMode: "raro", interestPercent: 5, commercialNote: "Hola" },
      ] as never,
    });
    expect(r.cashEnabled).toBe(false);
    expect(r.cashDiscountPercent).toBe("");
    expect(r.installmentPlans).toEqual([
      {
        id: "p1",
        numberOfInstallments: "3",
        interestMode: "none",
        interestPercent: "",
        commercialNote: "Hola",
        appliedIndexMetadata: null,
      },
    ]);
  });

  it("los ids de plan no se repiten ni pisan contado u omisión", () => {
    const r = normalizePaymentOptions({
      installmentPlans: [
        { id: "contado", numberOfInstallments: "2" },
        { id: "omision", numberOfInstallments: "3" },
        { id: "p", numberOfInstallments: "4" },
        { id: "p", numberOfInstallments: "5" },
      ] as never,
    });
    const ids = r.installmentPlans.map((p) => p.id);
    expect(ids).toEqual(["contado-2", "omision-2", "p", "p-2"]);
    expect(new Set([...ids, "contado", "omision"]).size).toBe(6);
  });

  it("los reemplazos de id son deterministas: normalizar dos veces da lo mismo", () => {
    const crudo = {
      installmentPlans: [
        { numberOfInstallments: "2" },
        { id: "  ", numberOfInstallments: "3" },
        { id: "plan-1", numberOfInstallments: "4" },
        { id: "x", numberOfInstallments: "5" },
        { id: "x", numberOfInstallments: "6" },
        { id: "x-2", numberOfInstallments: "7" },
      ],
    } as never;
    const a = normalizePaymentOptions(crudo);
    const b = normalizePaymentOptions(crudo);
    expect(a).toEqual(b);
    expect(a.installmentPlans.map((p) => p.id)).toEqual(["plan-1", "plan-2", "plan-1-2", "x", "x-2", "x-2-2"]);
    // Y lo ya normalizado no cambia.
    expect(normalizePaymentOptions(a)).toEqual(a);
  });

  it("un id de plan largo o con caracteres raros se reemplaza por plan-<posición>, de forma determinista", () => {
    const largo = "a".repeat(65);
    const justo = "b".repeat(64);
    const crudo = {
      installmentPlans: [
        { id: largo, numberOfInstallments: "2" },
        { id: "<script>", numberOfInstallments: "3" },
        { id: "con espacio", numberOfInstallments: "4" },
        { id: "ok_Plan-3", numberOfInstallments: "5" },
        { id: justo, numberOfInstallments: "6" },
        { id: justo, numberOfInstallments: "7" },
      ],
    } as never;
    const a = normalizePaymentOptions(crudo);
    const ids = a.installmentPlans.map((p) => p.id);
    expect(ids).toEqual(["plan-1", "plan-2", "plan-3", "ok_Plan-3", justo, `${"b".repeat(62)}-2`]);
    expect(ids.every((id) => /^[A-Za-z0-9_-]{1,64}$/.test(id))).toBe(true);
    expect(normalizePaymentOptions(crudo)).toEqual(a);
    expect(normalizePaymentOptions(a)).toEqual(a);
  });

  it("cashEnabled sólo se toma si es booleano de verdad", () => {
    expect(normalizePaymentOptions({ cashEnabled: false }).cashEnabled).toBe(false);
    expect(normalizePaymentOptions({ cashEnabled: true }).cashEnabled).toBe(true);
    for (const raro of ["false", 0, 1, null, "si", {}]) {
      expect(normalizePaymentOptions({ cashEnabled: raro } as never).cashEnabled).toBe(
        INITIAL_CUANTO_COBRO_PAYMENT_OPTIONS.cashEnabled,
      );
    }
  });
});

describe("opción por omisión", () => {
  it("6 cuotas sin fecha de evento", () => {
    expect(cuotasPorOmision("2026-10-08", null)).toBe(6);
    expect(opcionPorOmision({ total: 600_000, fechaEvento: null, hoy: "2026-10-08" })).toMatchObject({
      id: "omision",
      numberOfInstallments: 6,
      interestMode: "none",
      interestPercent: 0,
      financedTotal: 600_000,
      installmentAmount: 100_000,
      commercialNote: "Hasta 6 cuotas sin interés",
    });
  });

  it("los meses completos hasta el evento, con tope 6", () => {
    expect(cuotasPorOmision("2026-10-08", "2026-12-07")).toBe(1);
    expect(cuotasPorOmision("2026-10-08", "2026-12-08")).toBe(2);
    expect(cuotasPorOmision("2026-10-08", "2027-04-08")).toBe(6);
    expect(cuotasPorOmision("2026-10-08", "2028-01-01")).toBe(6);
    expect(opcionPorOmision({ total: 1000, fechaEvento: "2026-12-08", hoy: "2026-10-08" }).commercialNote).toBe(
      "Hasta 2 cuotas sin interés",
    );
  });

  it("evento pasado o este mes: 1 cuota", () => {
    expect(cuotasPorOmision("2026-10-08", "2026-09-01")).toBe(1);
    expect(cuotasPorOmision("2026-10-08", "2026-10-20")).toBe(1);
    expect(opcionPorOmision({ total: 1000, fechaEvento: "2026-09-01", hoy: "2026-10-08" }).commercialNote).toBe(
      "Hasta 1 cuota sin interés",
    );
  });
});

describe("opcionesParaPresupuesto", () => {
  const configuradas = {
    paymentOptions: {
      cashEnabled: true,
      cashDiscountPercent: "10",
      cashCommercialNote: " Pagando todo hoy ",
      installmentPlans: [
        { id: "p3", numberOfInstallments: "3", interestMode: "none", interestPercent: "", commercialNote: "" },
        { id: "p6", numberOfInstallments: "6", interestMode: "manual", interestPercent: "20", commercialNote: "" },
      ],
    },
  };

  it("usa las opciones de la organización calculadas sobre el total", () => {
    const s = opcionesParaPresupuesto(configuradas, 1_000_000, "2027-06-01", "2026-10-08", EN);
    expect(s.calculatedAt).toBe(EN);
    expect(s.cash).toMatchObject({ cashPrice: 900_000, commercialNote: "Pagando todo hoy" });
    expect(s.installmentPlans.map((p) => [p.id, p.financedTotal])).toEqual([
      ["p3", 1_000_000],
      ["p6", 1_200_000],
    ]);
  });

  it("sin opciones configuradas, la de omisión", () => {
    for (const ajustes of [null, undefined, {}, { paymentOptions: null }, { paymentOptions: [] }]) {
      const s = opcionesParaPresupuesto(ajustes, 500_000, null, "2026-10-08", EN);
      expect(s.cash).toBeNull();
      expect(s.installmentPlans).toHaveLength(1);
      expect(s.installmentPlans[0]).toMatchObject({ id: "omision", numberOfInstallments: 6, financedTotal: 500_000 });
    }
  });

  it("si lo configurado no ofrece nada (contado apagado y sin planes válidos), la de omisión", () => {
    const s = opcionesParaPresupuesto(
      { paymentOptions: { cashEnabled: false, installmentPlans: [{ id: "x", numberOfInstallments: "0" }] } },
      500_000,
      "2026-12-08",
      "2026-10-08",
      EN,
    );
    expect(s.installmentPlans.map((p) => [p.id, p.numberOfInstallments])).toEqual([["omision", 2]]);
  });

  it("la instantánea se guarda y se vuelve a leer igual", () => {
    const s = opcionesParaPresupuesto(configuradas, 1_000_000, null, "2026-10-08", EN);
    expect(parsePaymentOptionsSnapshot(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });
});

describe("opcionesDeInstantanea y buscarOpcion", () => {
  const s = opcionesParaPresupuesto(
    {
      paymentOptions: {
        cashEnabled: true,
        cashDiscountPercent: "10",
        installmentPlans: [
          { id: "p6", numberOfInstallments: "6", interestMode: "manual", interestPercent: "20", commercialNote: "Con tarjeta" },
        ],
      },
    },
    1_000_000,
    null,
    "2026-10-08",
    EN,
  );

  it("contado primero (id contado) y después los planes con su id", () => {
    const opciones = opcionesDeInstantanea(s);
    expect(opciones.map((o) => o.id)).toEqual(["contado", "p6"]);
    expect(opciones[0]).toMatchObject({
      tipo: "CONTADO",
      cuotas: 1,
      total: 900_000,
      descuentoPorcentaje: 10,
      etiqueta: "Contado con 10% de descuento",
    });
    expect(opciones[1]).toMatchObject({
      tipo: "CUOTAS",
      cuotas: 6,
      total: 1_200_000,
      importeCuota: 200_000,
      interesPorcentaje: 20,
      interes: 200_000,
      nota: "Con tarjeta",
      etiqueta: "6 cuotas con 20% de interés",
    });
  });

  it("la de omisión se llama 'Hasta N cuotas sin interés'", () => {
    const omision = opcionesParaPresupuesto(null, 1000, null, "2026-10-08", EN);
    expect(opcionesDeInstantanea(omision)[0]).toMatchObject({ id: "omision", etiqueta: "Hasta 6 cuotas sin interés", interes: 0 });
  });

  it("busca por id; sin id, la primera; con un id ajeno, null", () => {
    expect(buscarOpcion(s, "p6")?.total).toBe(1_200_000);
    expect(buscarOpcion(s, null)?.id).toBe("contado");
    expect(buscarOpcion(s, "")?.id).toBe("contado");
    expect(buscarOpcion(s, "otro")).toBeNull();
  });

  it("la opción elegida arma el plan con el total de la opción", () => {
    const plan = planDesdeOpcion(buscarOpcion(s, "p6")!, { desde: "2026-10-08", fechaEvento: null });
    expect(plan.cuotas).toHaveLength(6);
    expect(plan.cuotas.every((c) => c.amountArs === 200_000)).toBe(true);
    const contado = planDesdeOpcion(buscarOpcion(s, "contado")!, { desde: "2026-10-08" });
    expect(contado.cuotas).toEqual([{ position: 1, dueDate: "2026-10-08", amountArs: 900_000 }]);
  });
});
