import { describe, expect, it } from "vitest";
import { Prisma } from "@repo/db";
import { initialChargeTotal, monthlyAmountFor, scaleMultiplier } from "./amounts";

const d = (v: string) => new Prisma.Decimal(v);
const REF = d("10000");

describe("scaleMultiplier", () => {
  it.each([
    ["PLENA", "1"],
    ["REDUCIDA", "0.5"],
    ["EXENTA", "0"],
  ] as const)("%s vale %s", (scale, expected) => {
    expect(scaleMultiplier(scale).toString()).toBe(expected);
  });
});

describe("monthlyAmountFor", () => {
  it("el profesional paga la cuota plena", () => {
    expect(
      monthlyAmountFor({ referenceAmount: REF, scale: "PLENA", floorMultiple: 1 }).toFixed(2),
    ).toBe("10000.00");
  });

  it("el estudiante paga la mitad", () => {
    expect(
      monthlyAmountFor({ referenceAmount: REF, scale: "REDUCIDA", floorMultiple: 1 }).toFixed(2),
    ).toBe("5000.00");
  });

  it("el honorario no paga", () => {
    expect(
      monthlyAmountFor({ referenceAmount: REF, scale: "EXENTA", floorMultiple: 1 }).toFixed(2),
    ).toBe("0.00");
  });

  it("el colaborador paga el monto que eligió", () => {
    const r = monthlyAmountFor({
      referenceAmount: REF,
      scale: "PLENA",
      ownAmount: d("15000"),
      floorMultiple: 1,
    });
    expect(r.toFixed(2)).toBe("15000.00");
  });

  /** El piso existe para que "libre hacia arriba" no termine siendo hacia abajo. */
  it("un monto propio por debajo del piso se sube al piso", () => {
    const r = monthlyAmountFor({
      referenceAmount: REF,
      scale: "PLENA",
      ownAmount: d("500"),
      floorMultiple: 1,
    });
    expect(r.toFixed(2)).toBe("10000.00");
  });

  it("un monto propio exactamente igual al piso se acepta", () => {
    const r = monthlyAmountFor({
      referenceAmount: REF,
      scale: "PLENA",
      ownAmount: d("10000"),
      floorMultiple: 1,
    });
    expect(r.toFixed(2)).toBe("10000.00");
  });

  it("respeta un piso distinto del valor de referencia", () => {
    const r = monthlyAmountFor({
      referenceAmount: REF,
      scale: "PLENA",
      ownAmount: d("12000"),
      floorMultiple: 1.5,
    });
    expect(r.toFixed(2)).toBe("15000.00");
  });

  it("redondea a 2 decimales", () => {
    const r = monthlyAmountFor({
      referenceAmount: d("3333.33"),
      scale: "REDUCIDA",
      floorMultiple: 1,
    });
    expect(r.toFixed(2)).toBe("1666.67");
  });

  it("nunca devuelve un monto negativo", () => {
    const r = monthlyAmountFor({ referenceAmount: d("0"), scale: "PLENA", floorMultiple: 1 });
    expect(r.isNegative()).toBe(false);
  });
});

describe("initialChargeTotal", () => {
  it("tres cuotas plenas de 10.000 dan 30.000", () => {
    expect(initialChargeTotal(d("10000"), 3).toFixed(2)).toBe("30000.00");
  });

  it("tres cuotas reducidas dan la mitad", () => {
    expect(initialChargeTotal(d("5000"), 3).toFixed(2)).toBe("15000.00");
  });

  it("con cero cuotas el total es cero", () => {
    expect(initialChargeTotal(d("10000"), 0).toFixed(2)).toBe("0.00");
  });

  /**
   * El total cobrado tiene que ser exactamente la suma de los cargos generados. Si
   * difirieran, el socio pagaría un monto que no coincide con lo que figura adeudado.
   */
  it.each(["10000", "3333.33", "0.01", "12345.67"])(
    "el total de %s x3 es la suma exacta de las cuotas",
    (monto) => {
      const monthly = d(monto);
      expect(initialChargeTotal(monthly, 3).toFixed(2)).toBe(monthly.mul(3).toFixed(2));
    },
  );
});
