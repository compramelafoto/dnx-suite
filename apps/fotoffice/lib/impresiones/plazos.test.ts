import { describe, expect, it } from "vitest";
import { fechaPorPlazo } from "./plazos";

/** Hora argentina (UTC-3) → Date. */
const ar = (ymd: string, hhmm: string) => new Date(`${ymd}T${hhmm}:00-03:00`);

describe("fecha prometida por plazo", () => {
  it("instantánea: hoy; para mañana: el siguiente día hábil", () => {
    expect(fechaPorPlazo("INSTANTANEA", ar("2026-10-30", "10:00"))).toBe("2026-10-30");
    expect(fechaPorPlazo("MANANA", ar("2026-10-28", "10:00"))).toBe("2026-10-29");
    // Viernes → lunes.
    expect(fechaPorPlazo("MANANA", ar("2026-10-30", "10:00"))).toBe("2026-11-02");
    // Pagado tarde a la noche en Argentina sigue siendo ese día.
    expect(fechaPorPlazo("MANANA", ar("2026-10-28", "23:30"))).toBe("2026-10-29");
  });

  it("próxima semana: el primer martes o viernes cuyo mediodía esté al menos 48 h después del pago", () => {
    expect(fechaPorPlazo("SEMANA", ar("2026-11-02", "10:00"))).toBe("2026-11-06"); // martes 3 a 26 h
    expect(fechaPorPlazo("SEMANA", ar("2026-11-03", "15:00"))).toBe("2026-11-06"); // viernes 6 a 69 h
    expect(fechaPorPlazo("SEMANA", ar("2026-11-04", "12:00"))).toBe("2026-11-06"); // 48 h justas
    expect(fechaPorPlazo("SEMANA", ar("2026-11-04", "12:01"))).toBe("2026-11-10");
    expect(fechaPorPlazo("SEMANA", ar("2026-11-07", "11:00"))).toBe("2026-11-10"); // sábado → martes a 73 h
    expect(fechaPorPlazo("SEMANA", ar("2026-11-08", "13:00"))).toBe("2026-11-13"); // domingo 13 h → martes a 47 h
  });

  it("si el martes o viernes es feriado, pasa al siguiente retiro", () => {
    // Viernes 25/12/2026 es Navidad.
    expect(fechaPorPlazo("SEMANA", ar("2026-12-21", "10:00"))).toBe("2026-12-29");
  });

  it("nunca pasa de 7 días corridos", () => {
    for (let d = 1; d <= 30; d++) {
      const pago = ar(`2026-11-${String(d).padStart(2, "0")}`, "12:01");
      const f = new Date(`${fechaPorPlazo("SEMANA", pago)}T12:00:00-03:00`);
      expect((f.getTime() - pago.getTime()) / 86_400_000).toBeLessThanOrEqual(7);
    }
  });
});
