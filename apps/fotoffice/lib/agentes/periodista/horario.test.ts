import { describe, expect, it } from "vitest";
import { diaArgentino, fechaHoraArgentina, horaDePublicacion, inicioDelDiaArgentino, textoDePublicacion } from "./horario";

describe("horario argentino", () => {
  it("el día argentino cambia a las 3:00 UTC", () => {
    expect(diaArgentino(new Date("2026-11-09T02:59:00.000Z"))).toBe("2026-11-08");
    expect(diaArgentino(new Date("2026-11-09T03:00:00.000Z"))).toBe("2026-11-09");
    expect(inicioDelDiaArgentino(new Date("2026-11-09T01:00:00.000Z")).toISOString()).toBe("2026-11-08T03:00:00.000Z");
  });

  it("el cron de las 12:00 UTC es a las 9:00 AR", () => {
    expect(fechaHoraArgentina(new Date("2026-11-09T12:00:00.000Z"))).toBe("lunes 9/11, 9:00");
  });

  it("aprobada antes de las 11:00 AR sale a las 11:00 AR (14:00 UTC)", () => {
    const ahora = new Date("2026-11-09T12:30:00.000Z");
    const p = horaDePublicacion(ahora);
    expect(p.toISOString()).toBe("2026-11-09T14:00:00.000Z");
    expect(textoDePublicacion(p, ahora)).toBe("hoy a las 11:00");
  });

  it("aprobada después de las 11:00 AR sale enseguida (aunque sea tarde a la noche)", () => {
    const ahora = new Date("2026-11-09T15:00:00.000Z");
    expect(horaDePublicacion(ahora).toISOString()).toBe(ahora.toISOString());
    expect(textoDePublicacion(horaDePublicacion(ahora), ahora)).toBe("ahora mismo");
    // 23:30 AR del lunes = 02:30 UTC del martes: sigue siendo "el lunes", ya pasaron las 11.
    const noche = new Date("2026-11-10T02:30:00.000Z");
    expect(horaDePublicacion(noche).toISOString()).toBe(noche.toISOString());
  });

  it("de madrugada (antes de las 11 AR) espera a las 11 de ese mismo día", () => {
    expect(horaDePublicacion(new Date("2026-11-10T04:00:00.000Z")).toISOString()).toBe("2026-11-10T14:00:00.000Z");
  });
});
