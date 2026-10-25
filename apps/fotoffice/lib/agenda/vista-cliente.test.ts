import { describe, expect, it } from "vitest";
import {
  capasIniciales,
  conservarDeLaDireccion,
  correrEvento,
  desplazamiento,
  diasDeTodoElDia,
  direccionAgenda,
  horaDeMinuto,
  instanteDeFormulario,
  leerCapasGuardadas,
  leerParametros,
  limitesDeHoras,
  partesDeInstante,
  rangoTodoElDia,
  redondear,
  segmentosDelEvento,
  ultimoDiaTodoElDia,
} from "./vista-cliente";

const AHORA = new Date("2026-10-09T15:00:00.000Z");

describe("dirección de la agenda", () => {
  it("lo raro vuelve a hoy, semana y sin filtros", () => {
    expect(leerParametros({ fecha: "basura", vista: "x", responsable: "abc", cita: "../x" }, AHORA)).toMatchObject({
      ymd: "2026-10-09", vista: "semana", vistaCalendario: "semana", ownerUserId: null, citaId: null,
    });
  });
  it("la lista recorre meses y se reconoce de dos maneras", () => {
    expect(leerParametros({ vista: "lista" }, AHORA)).toMatchObject({ vista: "lista", vistaCalendario: "mes" });
    expect(leerParametros({ vista: "mes", lista: "1" }, AHORA)).toMatchObject({ vista: "lista", vistaCalendario: "mes" });
    expect(leerParametros({ vista: "mes" }, AHORA).vista).toBe("mes");
  });
  it("lee responsable, cita y la cita nueva ligada a un registro", () => {
    const r = leerParametros({ responsable: "12", cita: "abc_1", nueva: "1", pedido: "ped-9", proyecto: "no valido!" }, AHORA);
    expect(r.ownerUserId).toBe(12);
    expect(r.citaId).toBe("abc_1");
    expect(r.nueva).toEqual({ abrir: true, proyectoId: null, pedidoId: "ped-9", consultaLeadId: null });
  });
  it("arma las direcciones conservando la lista y el responsable", () => {
    expect(direccionAgenda("lista", "2026-10-09", 3)).toBe("/agenda?fecha=2026-10-09&vista=mes&lista=1&responsable=3");
    expect(direccionAgenda("semana", "2026-10-09", null)).toBe("/agenda?fecha=2026-10-09&vista=semana");
    expect(conservarDeLaDireccion("lista", 3)).toEqual({ lista: "1", responsable: "3" });
    expect(conservarDeLaDireccion("dia", null)).toEqual({ lista: undefined, responsable: undefined });
  });
});

describe("eventos por día (hora de Argentina)", () => {
  const dia = "2026-10-09";
  it("parte un evento que cruza la medianoche en dos tramos", () => {
    // 22:00 del 9 a 02:00 del 10 (Argentina) = 01:00 a 05:00 UTC.
    const s = segmentosDelEvento(new Date("2026-10-10T01:00:00.000Z"), new Date("2026-10-10T05:00:00.000Z"), [dia, "2026-10-10", "2026-10-11"]);
    expect(s).toEqual([
      { ymd: dia, desde: 22 * 60, hasta: 1440 },
      { ymd: "2026-10-10", desde: 0, hasta: 120 },
    ]);
  });
  it("un evento de todo el día ocupa sólo su día; el fin es exclusivo", () => {
    const inicio = new Date("2026-10-09T03:00:00.000Z");
    const fin = new Date("2026-10-10T03:00:00.000Z");
    expect(diasDeTodoElDia(inicio, fin, [dia, "2026-10-10"])).toEqual([dia]);
    expect(ultimoDiaTodoElDia(inicio.toISOString(), fin.toISOString())).toBe(dia);
  });
  it("redondea y formatea minutos", () => {
    expect(redondear(37, 15)).toBe(30);
    expect(redondear(38, 15)).toBe(45);
    expect(horaDeMinuto(9 * 60 + 5)).toBe("09:05");
    expect(horaDeMinuto(1440)).toBe("00:00");
  });
  it("arrastrar conserva la duración y puede cambiar de día", () => {
    const ini = new Date("2026-10-09T12:00:00.000Z");
    const fin = new Date("2026-10-09T13:30:00.000Z");
    // De las 09:00 del 9 a las 11:15 del 11.
    const delta = desplazamiento({ ymd: "2026-10-09", minuto: 9 * 60 }, { ymd: "2026-10-11", minuto: 11 * 60 + 15 });
    const m = correrEvento(ini, fin, delta);
    expect(m.fin.getTime() - m.inicio.getTime()).toBe(90 * 60_000);
    expect(partesDeInstante(m.inicio.toISOString())).toEqual({ dia: "2026-10-11", hora: "11:15" });
  });
  it("la grilla se estira para que ningún evento quede afuera", () => {
    expect(limitesDeHoras([])).toEqual({ startHour: 7, endHour: 22 });
    expect(limitesDeHoras([{ desde: 5 * 60 + 30, hasta: 6 * 60 }, { desde: 21 * 60, hasta: 23 * 60 + 15 }])).toEqual({ startHour: 5, endHour: 24 });
  });
});

describe("formulario ↔ instantes", () => {
  it("pasa la hora de Argentina a UTC y vuelve", () => {
    const iso = instanteDeFormulario("2026-10-09", "15:30");
    expect(iso).toBe("2026-10-09T18:30:00.000Z");
    expect(partesDeInstante(iso!)).toEqual({ dia: "2026-10-09", hora: "15:30" });
  });
  it("rechaza fechas y horas inválidas", () => {
    expect(instanteDeFormulario("2026-02-31", "10:00")).toBeNull();
    expect(instanteDeFormulario("2026-10-09", "25:00")).toBeNull();
    expect(instanteDeFormulario("", "10:00")).toBeNull();
  });
  it("una cita de todo el día de dos días ocupa de 00:00 a 00:00 de Argentina", () => {
    expect(rangoTodoElDia("2026-10-09", "2026-10-10")).toEqual({ startAt: "2026-10-09T03:00:00.000Z", endAt: "2026-10-11T03:00:00.000Z" });
    expect(rangoTodoElDia("2026-10-10", "2026-10-09")).toBeNull();
  });
});

describe("capas encendidas", () => {
  it("lee lo guardado en el navegador y descarta lo ajeno", () => {
    expect(leerCapasGuardadas('["TAREAS","CITAS","X"]')).toEqual(["CITAS", "TAREAS"]);
    expect(leerCapasGuardadas("[]")).toEqual([]);
    expect(leerCapasGuardadas("no es json")).toBeNull();
    expect(leerCapasGuardadas('{"a":1}')).toBeNull();
    expect(leerCapasGuardadas("")).toBeNull();
    expect(leerCapasGuardadas(null)).toBeNull();
  });
  it("arranca con las del taller, o las de siempre, limitadas a las que puede ver", () => {
    expect(capasIniciales(["CITAS", "CUOTAS", "RESERVAS"], undefined)).toEqual(["CITAS", "RESERVAS"]);
    expect(capasIniciales(["CITAS", "CUOTAS"], ["CUOTAS", "ZZZ"])).toEqual(["CUOTAS"]);
  });
});
