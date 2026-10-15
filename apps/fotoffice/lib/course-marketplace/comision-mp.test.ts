import { describe, expect, it } from "vitest";
import { estimarComisionMp, TASA_MP_ESTIMADA_BPS } from "./comision-mp";

describe("estimación de la comisión de Mercado Pago", () => {
  it("se calcula sobre lo que paga el alumno, con la tasa por defecto", () => {
    expect(TASA_MP_ESTIMADA_BPS).toBe(761);
    expect(estimarComisionMp(10_500_000)).toBe(799_050);
  });

  it("acepta otra tasa", () => {
    expect(estimarComisionMp(10_000, 500)).toBe(500);
  });
});
