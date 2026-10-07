import { describe, expect, it } from "vitest";
import { ESTADOS_PRESUPUESTO } from "./constantes";
import { diaEnBuenosAires, estadoEfectivo, puedePasar, TRANSICIONES, vencimientoDesde, vencio } from "./estados";

describe("transiciones", () => {
  it("cubren todos los estados y ACEPTADO es final", () => {
    expect(Object.keys(TRANSICIONES).sort()).toEqual([...ESTADOS_PRESUPUESTO].sort());
    for (const a of ESTADOS_PRESUPUESTO) expect(puedePasar("ACEPTADO", a)).toBe(false);
  });

  it("un borrador sólo se envía; vencido o rechazado sólo vuelven con un envío", () => {
    expect(ESTADOS_PRESUPUESTO.filter((a) => puedePasar("BORRADOR", a))).toEqual(["ENVIADO"]);
    expect(puedePasar("VENCIDO", "ACEPTADO")).toBe(false);
    expect(puedePasar("RECHAZADO", "ACEPTADO")).toBe(false);
    expect(puedePasar("VISTO", "ACEPTADO")).toBe(true);
    expect(puedePasar("ENVIADO", "BORRADOR")).toBe(false);
  });
});

describe("fechas en Buenos Aires", () => {
  it("a las 23 de Argentina (02 UTC del día siguiente) todavía es el mismo día", () => {
    const ahora = new Date("2026-10-08T02:00:00.000Z");
    expect(diaEnBuenosAires(ahora)).toBe("2026-10-07");
    expect(vencimientoDesde(ahora, 15).toISOString()).toBe("2026-10-22T00:00:00.000Z");
  });

  it("el último día todavía vale; el siguiente, vencido (sólo enviados y vistos)", () => {
    const vence = new Date("2026-10-22T00:00:00.000Z");
    expect(vencio(vence, new Date("2026-10-23T02:59:00.000Z"))).toBe(false);
    expect(vencio(vence, new Date("2026-10-23T03:00:00.000Z"))).toBe(true);
    const despues = new Date("2026-11-01T12:00:00.000Z");
    expect(estadoEfectivo("ENVIADO", vence, despues)).toBe("VENCIDO");
    expect(estadoEfectivo("VISTO", vence, despues)).toBe("VENCIDO");
    for (const s of ["BORRADOR", "ACEPTADO", "RECHAZADO"] as const) expect(estadoEfectivo(s, vence, despues)).toBe(s);
    expect(estadoEfectivo("ENVIADO", null, despues)).toBe("ENVIADO");
  });
});
