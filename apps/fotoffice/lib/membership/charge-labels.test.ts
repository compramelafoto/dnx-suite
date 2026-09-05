import { describe, expect, it } from "vitest";
import {
  APERTURA_LABEL,
  chargeConceptLabel,
  chargePeriodLabel,
  fechaLegible,
  isOpeningBalance,
  periodoLegible,
} from "./charge-labels";

describe("periodoLegible", () => {
  it("traduce un período mensual", () => {
    expect(periodoLegible("2026-09")).toBe("septiembre de 2026");
    expect(periodoLegible("2026-01")).toBe("enero de 2026");
    expect(periodoLegible("2026-12")).toBe("diciembre de 2026");
  });

  it("devuelve el valor crudo si no es un período mensual", () => {
    // No inventa una traducción: cualquier cosa que no sea AAAA-MM sale como vino, y de
    // eso se ocupa `chargePeriodLabel`, no esta función.
    expect(periodoLegible("APERTURA")).toBe("APERTURA");
    expect(periodoLegible("2026-13")).toBe("2026-13");
    expect(periodoLegible("")).toBe("");
  });
});

describe("isOpeningBalance", () => {
  it("reconoce el saldo traído del sistema anterior", () => {
    expect(isOpeningBalance("APERTURA")).toBe(true);
  });

  it("no confunde una cuota mensual con un saldo de apertura", () => {
    expect(isOpeningBalance("2026-09")).toBe(false);
  });
});

describe("chargePeriodLabel", () => {
  it("nunca le muestra al socio la palabra APERTURA", () => {
    const label = chargePeriodLabel("APERTURA");
    expect(label).toBe("Deuda anterior al sistema");
    expect(label).not.toContain("APERTURA");
  });

  it("usa el período legible para las cuotas del mes", () => {
    expect(chargePeriodLabel("2026-09")).toBe("septiembre de 2026");
  });
});

describe("chargeConceptLabel", () => {
  it("no llama «cuota mensual» a un saldo de apertura", () => {
    // Este es el error que veía el socio: un arrastre de $60.000 rotulado como si fuera
    // la cuota del mes.
    const label = chargeConceptLabel("OTRO", "APERTURA");
    expect(label).toBe("Saldo traído del sistema anterior");
    expect(label).not.toContain("mensual");
  });

  it("distingue la cuota de ingreso de la mensual", () => {
    expect(chargeConceptLabel("INGRESO", "2026-09")).toBe("Cuota de ingreso");
    expect(chargeConceptLabel("MENSUAL", "2026-09")).toBe("Cuota mensual");
  });

  it("ante un concepto desconocido no afirma que es una cuota mensual", () => {
    // Decir "Cuota mensual" por defecto es exactamente lo que produjo el error anterior.
    expect(chargeConceptLabel("LO_QUE_SEA", "2026-09")).toBe("Otro concepto");
  });

  it("expone la etiqueta de apertura para reutilizarla en los avisos", () => {
    expect(APERTURA_LABEL).toBe("Deuda anterior al sistema");
  });
});

describe("fechaLegible", () => {
  it("escribe el vencimiento como lo diría una persona", () => {
    expect(fechaLegible(new Date("2026-09-10T00:00:00Z"))).toBe("10 de septiembre");
    expect(fechaLegible(new Date("2026-01-05T00:00:00Z"))).toBe("5 de enero");
  });

  it("lee en UTC, no en la zona del servidor", () => {
    // Guardado a medianoche UTC, el mismo cargo no puede decir «9» en un servidor y «10» en
    // otro según dónde esté desplegado.
    expect(fechaLegible(new Date("2026-09-10T00:00:00Z"))).toBe("10 de septiembre");
    expect(fechaLegible(new Date("2026-09-10T23:59:59Z"))).toBe("10 de septiembre");
  });
});
