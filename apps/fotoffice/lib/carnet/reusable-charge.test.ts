import { describe, expect, it } from "vitest";
import { reusablePrintOrderCharge } from "./reusable-charge";

/**
 * El cargo pagado de una tarjeta que se anuló no se pierde.
 *
 * Si la credencial salió mal, se perdió en el correo o se anuló por cualquier motivo después
 * de que el socio la pagara, la próxima se engancha a ese mismo cargo. Cobrarle de nuevo
 * sería hacerle pagar dos veces un error que no cometió.
 */

describe("reusablePrintOrderCharge", () => {
  it("devuelve el cargo pagado que quedó sin tarjeta", () => {
    const r = reusablePrintOrderCharge({
      charges: [{ id: "cargo-1", balanceMinor: 0 }],
      takenChargeIds: [],
    });
    expect(r).toBe("cargo-1");
  });

  it("ignora el cargo que todavía se debe", () => {
    // Un cargo impago no es crédito a favor de nadie: engancharse a él regalaría la tarjeta.
    const r = reusablePrintOrderCharge({
      charges: [{ id: "cargo-1", balanceMinor: 800000 }],
      takenChargeIds: [],
    });
    expect(r).toBeNull();
  });

  it("ignora el cargo que ya está pagando una tarjeta viva", () => {
    // La credencial que pagó está entregada o en camino: ese cargo ya entregó lo suyo.
    const r = reusablePrintOrderCharge({
      charges: [{ id: "cargo-1", balanceMinor: 0 }],
      takenChargeIds: ["cargo-1"],
    });
    expect(r).toBeNull();
  });

  it("con varios libres toma el más viejo, que es el que más esperó", () => {
    const r = reusablePrintOrderCharge({
      charges: [
        { id: "cargo-viejo", balanceMinor: 0 },
        { id: "cargo-nuevo", balanceMinor: 0 },
      ],
      takenChargeIds: [],
    });
    expect(r).toBe("cargo-viejo");
  });
});
