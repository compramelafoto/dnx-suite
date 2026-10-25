import { describe, expect, it } from "vitest";
import { horarioDelDia, leTocaElSabado, validarFranjas, type FichaHorario } from "./horario";
import { diaYMinuto, minutosDesdeElDia, sumarDias, diaDeSemana, leerHora, horaLegible } from "./fechas";

// Sabina en DNX Estudio: lunes a viernes de 8 a 13 y sábados alternados de 9 a 13 (datos que
// carga el dueño en la ficha; acá son sólo un ejemplo para las pruebas).
const sabina: FichaHorario = {
  franjas: [0, 1, 2, 3, 4].map((d) => ({ diaSemana: d, inicioMin: 480, finMin: 780 })).concat([{ diaSemana: 5, inicioMin: 540, finMin: 780 }]),
  sabadosAlternados: true,
  sabadoReferencia: "2026-10-24",
};

describe("fechas en hora argentina", () => {
  it("una apertura a las 22 de Buenos Aires sigue siendo de ese día aunque en UTC ya sea el siguiente", () => {
    expect(diaYMinuto(new Date("2026-10-27T01:00:00Z"))).toEqual({ fecha: "2026-10-26", minuto: 22 * 60 });
  });
  it("un cierre pasada la medianoche da más de 1440 minutos", () => {
    expect(minutosDesdeElDia("2026-10-26", new Date("2026-10-27T04:30:00Z"))).toBe(1440 + 90);
  });
  it("días de la semana, sumas y horas", () => {
    expect(diaDeSemana("2026-10-26")).toBe(0);
    expect(diaDeSemana("2026-10-25")).toBe(6);
    expect(sumarDias("2026-10-31", 1)).toBe("2026-11-01");
    expect(leerHora("08:30")).toBe(510);
    expect(leerHora("25:00")).toBeNull();
    expect(horaLegible(1500)).toBe("1:00 (día siguiente)");
  });
});

describe("sábados alternados", () => {
  it("le toca el sábado de referencia y uno sí, uno no", () => {
    expect(leTocaElSabado("2026-10-24", "2026-10-24")).toBe(true);
    expect(leTocaElSabado("2026-10-31", "2026-10-24")).toBe(false);
    expect(leTocaElSabado("2026-11-07", "2026-10-24")).toBe(true);
    expect(leTocaElSabado("2026-10-17", "2026-10-24")).toBe(false);
  });
  it("sin fecha de referencia se toma que trabaja", () => {
    expect(leTocaElSabado("2026-10-31", null)).toBe(true);
  });
});

describe("horarioDelDia", () => {
  it("un lunes común: su horario fijo de 5 horas", () => {
    const h = horarioDelDia(sabina, [], "2026-10-26");
    expect(h).toMatchObject({ origen: "HORARIO", minutos: 300, inicioMin: 480, finMin: 780, trabaja: true, feriado: null });
  });
  it("el sábado que le toca vale 4 horas, y el otro está libre", () => {
    expect(horarioDelDia(sabina, [], "2026-10-24")).toMatchObject({ origen: "HORARIO", minutos: 240, trabaja: true });
    expect(horarioDelDia(sabina, [], "2026-10-31")).toMatchObject({ origen: "SABADO_LIBRE", minutos: 0, trabaja: false });
  });
  it("el domingo no tiene horario", () => {
    expect(horarioDelDia(sabina, [], "2026-10-25")).toMatchObject({ origen: "SIN_HORARIO", trabaja: false });
  });
  it("en un feriado se muestra el horario pero no se espera que trabaje", () => {
    const h = horarioDelDia(sabina, [], "2026-12-08");
    expect(h.feriado).toContain("Inmaculada");
    expect(h.minutos).toBe(300);
    expect(h.trabaja).toBe(false);
  });
  it("un cambio puntual gana: cambio de turno con otro horario, o un día que no trabaja", () => {
    const cambio = horarioDelDia(
      sabina,
      [{ fecha: "2026-10-26", tipo: "TRABAJA", motivo: "CAMBIO_TURNO", inicioMin: 840, finMin: 1140 }],
      "2026-10-26",
    );
    expect(cambio).toMatchObject({ origen: "CAMBIO", inicioMin: 840, finMin: 1140, trabaja: true });
    const vacaciones = horarioDelDia(
      sabina,
      [{ fecha: "2026-10-27", tipo: "NO_TRABAJA", motivo: "VACACIONES", inicioMin: null, finMin: null }],
      "2026-10-27",
    );
    expect(vacaciones).toMatchObject({ origen: "NO_TRABAJA", motivo: "VACACIONES", trabaja: false });
  });
  it("un cambio que dice que trabaja en un feriado sí la espera", () => {
    const h = horarioDelDia(
      sabina,
      [{ fecha: "2026-12-08", tipo: "TRABAJA", motivo: "OTRO", inicioMin: 540, finMin: 780 }],
      "2026-12-08",
    );
    expect(h.trabaja).toBe(true);
  });
  it("un día con dos franjas suma las dos y va de la primera entrada a la última salida", () => {
    const ficha: FichaHorario = {
      franjas: [
        { diaSemana: 0, inicioMin: 900, finMin: 1140 },
        { diaSemana: 0, inicioMin: 480, finMin: 780 },
      ],
      sabadosAlternados: false,
      sabadoReferencia: null,
    };
    expect(horarioDelDia(ficha, [], "2026-10-26")).toMatchObject({ minutos: 540, inicioMin: 480, finMin: 1140 });
  });
});

describe("validarFranjas", () => {
  it("acepta un horario normal", () => {
    expect(validarFranjas(sabina.franjas).ok).toBe(true);
  });
  it("rechaza una franja al revés y dos que se pisan", () => {
    expect(validarFranjas([{ diaSemana: 0, inicioMin: 780, finMin: 480 }]).ok).toBe(false);
    expect(
      validarFranjas([
        { diaSemana: 0, inicioMin: 480, finMin: 780 },
        { diaSemana: 0, inicioMin: 720, finMin: 900 },
      ]).ok,
    ).toBe(false);
  });
});
