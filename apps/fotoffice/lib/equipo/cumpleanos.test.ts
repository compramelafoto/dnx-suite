import { describe, expect, it } from "vitest";
import { cumpleanosDelAnio, diaDelSaludoDeCumple, saludaCumpleHoy } from "./cumpleanos";
import { horarioDelDia, type FichaHorario } from "./horario";

// Lunes a viernes de 8 a 13 y sábados alternados (le toca el 24/10, no el 31/10).
const ficha: FichaHorario = {
  franjas: [0, 1, 2, 3, 4].map((d) => ({ diaSemana: d, inicioMin: 480, finMin: 780 })).concat([{ diaSemana: 5, inicioMin: 540, finMin: 780 }]),
  sabadosAlternados: true,
  sabadoReferencia: "2026-10-24",
};
const trabaja = (fecha: string) => horarioDelDia(ficha, [], fecha).trabaja;

describe("cumpleaños", () => {
  it("el 29 de febrero se festeja el 28 en los años no bisiestos", () => {
    expect(cumpleanosDelAnio("2000-02-29", 2026)).toBe("2026-02-28");
    expect(cumpleanosDelAnio("2000-02-29", 2028)).toBe("2028-02-29");
  });

  it("si trabaja ese día, se la saluda el mismo día", () => {
    expect(diaDelSaludoDeCumple("1995-10-26", 2026, trabaja)).toBe("2026-10-26");
  });

  it("si cae domingo, se la saluda su último día de trabajo antes (el sábado que le toca)", () => {
    expect(diaDelSaludoDeCumple("1995-10-25", 2026, trabaja)).toBe("2026-10-24");
  });

  it("si cae el sábado que le toca a la otra, se la saluda el viernes", () => {
    expect(diaDelSaludoDeCumple("1995-10-31", 2026, trabaja)).toBe("2026-10-30");
  });

  it("si cae domingo después del sábado libre, también el viernes", () => {
    expect(diaDelSaludoDeCumple("1995-11-01", 2026, trabaja)).toBe("2026-10-30");
  });

  it("un feriado cuenta como día que no trabaja", () => {
    // 8/12/2026 es martes y feriado: se la saluda el lunes 7.
    expect(diaDelSaludoDeCumple("1995-12-08", 2026, trabaja)).toBe("2026-12-07");
  });

  it("el cumpleaños del 1 de enero puede saludarse el 31 de diciembre", () => {
    // 1/1/2027 es viernes y feriado: se saluda el jueves 31/12/2026.
    expect(saludaCumpleHoy({ fechaNacimiento: "1990-01-01", hoy: "2026-12-31", trabaja, estaTrabajandoHoy: true })).toBe(true);
  });

  it("si igual vino a trabajar el día del cumpleaños, también se la saluda ese día", () => {
    expect(saludaCumpleHoy({ fechaNacimiento: "1995-10-25", hoy: "2026-10-25", trabaja, estaTrabajandoHoy: true })).toBe(true);
    expect(saludaCumpleHoy({ fechaNacimiento: "1995-10-25", hoy: "2026-10-25", trabaja, estaTrabajandoHoy: false })).toBe(false);
  });

  it("sin fecha de nacimiento no saluda", () => {
    expect(saludaCumpleHoy({ fechaNacimiento: null, hoy: "2026-10-26", trabaja, estaTrabajandoHoy: true })).toBe(false);
  });

  it("de vacaciones dos semanas antes del cumpleaños: no se fuerza un saludo", () => {
    expect(diaDelSaludoDeCumple("1995-10-26", 2026, () => false)).toBeNull();
  });
});
