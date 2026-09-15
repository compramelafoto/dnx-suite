import { describe, expect, it } from "vitest";
import { fechaArgentina, fechaHoraArgentina, horaArgentina } from "./format";

/**
 * Las fechas como se escriben acá.
 *
 * `26.09.2026`, con puntos. El formato lo fija el diseño y no es decorativo: una fecha leída
 * al revés —26 de septiembre contra 9 de junio— manda a un fotógrafo el día equivocado.
 *
 * La zona es siempre `America/Argentina/Buenos_Aires`, no la del servidor: Vercel corre en
 * UTC, y sin fijarla una cobertura de las 21 h aparecería al día siguiente.
 */
describe("fechaArgentina", () => {
  it("escribe con puntos, día primero", () => {
    expect(fechaArgentina(new Date("2026-09-26T17:00:00Z"))).toBe("26.09.2026");
  });

  it("rellena con cero los días y meses de un dígito", () => {
    expect(fechaArgentina(new Date("2026-01-05T15:00:00Z"))).toBe("05.01.2026");
  });

  it("usa la zona de Argentina, no la del servidor", () => {
    // 2026-09-27T01:30 UTC son las 22:30 del 26 en Argentina. Sin fijar la zona, esta fecha
    // aparecería como 27.
    expect(fechaArgentina(new Date("2026-09-27T01:30:00Z"))).toBe("26.09.2026");
  });
});

describe("horaArgentina", () => {
  it("escribe la hora en 24 h", () => {
    expect(horaArgentina(new Date("2026-09-26T17:00:00Z"))).toBe("14:00");
  });

  it("la medianoche es 00:00 y no 24:00", () => {
    expect(horaArgentina(new Date("2026-09-26T03:00:00Z"))).toBe("00:00");
  });
});

describe("fechaHoraArgentina", () => {
  it("junta las dos", () => {
    expect(fechaHoraArgentina(new Date("2026-09-26T17:00:00Z"))).toBe("26.09.2026, 14:00");
  });
});
