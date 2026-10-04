import { describe, expect, it } from "vitest";
import { Prisma } from "@repo/db";
import { recalcularReparto } from "./enrollment-workflow";

describe("la comisión no cambia después del pago", () => {
  it("usa el porcentaje congelado en la inscripción, no uno nuevo", () => {
    const r = recalcularReparto({
      montoCobrado: new Prisma.Decimal("100000"),
      feePercentCongelado: new Prisma.Decimal("5"),
    });
    expect(r.fee.toString()).toBe("5000");
    expect(r.net.toString()).toBe("95000");
  });

  it("si Mercado Pago acredita menos, se reparte ese monto con el mismo porcentaje", () => {
    const r = recalcularReparto({
      montoCobrado: new Prisma.Decimal("80000"),
      feePercentCongelado: new Prisma.Decimal("5"),
    });
    expect(r.fee.toString()).toBe("4000");
    expect(r.net.toString()).toBe("76000");
  });

  it("la suma cierra contra el monto cobrado, sin centavos perdidos", () => {
    const monto = new Prisma.Decimal("33333.33");
    const r = recalcularReparto({
      montoCobrado: monto,
      feePercentCongelado: new Prisma.Decimal("7.25"),
    });
    expect(r.fee.plus(r.net).toString()).toBe(monto.toString());
  });
});
