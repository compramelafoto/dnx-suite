import { describe, expect, it } from "vitest";
import { hojaDeCalendario, lineasDelEvento, respuestasDelFormulario, textoDeCuantoFalta, resumirVistas, textoCortoDeVistas, textoDeFechaDelEvento, textoDeVistas, type EventoDeCotizacion } from "./evento-vista";

const VACIO: EventoDeCotizacion = {
  tipo: null, fecha: null, horaConocida: false, lugar: null, ceremonia: null, recepcion: null, ciudad: null,
  invitados: null, protagonistas: null, origen: null, mensaje: null, horas: null, km: null, segundoFotografo: false,
};

describe("datos del evento de la cotización", () => {
  it("sin datos no hay líneas", () => {
    expect(lineasDelEvento(VACIO)).toEqual([]);
    expect(lineasDelEvento({ ...VACIO, tipo: "  ", invitados: 0, horas: 0 })).toEqual([]);
  });

  it("sólo las líneas con dato, en orden", () => {
    const l = lineasDelEvento({
      ...VACIO,
      tipo: "Fotografía o Video de Cumpleaños de 15",
      fecha: new Date("2026-12-12T00:00:00.000Z"),
      lugar: "Salón María Eventos, Rosario",
      invitados: 120,
      horas: 6,
      km: 22.3,
      segundoFotografo: true,
      origen: "WhatsApp",
    });
    expect(l.map((x) => x.termino)).toEqual(["Tipo de evento", "Fecha", "Lugar", "Invitados", "Horas de cobertura", "Segundo fotógrafo", "Distancia desde el estudio", "Origen"]);
    expect(l.find((x) => x.termino === "Fecha")?.valor).toBe("sábado 12/12/2026");
    expect(l.find((x) => x.termino === "Horas de cobertura")?.valor).toBe("6 h");
    expect(l.find((x) => x.termino === "Distancia desde el estudio")?.valor).toBe("22 km");
  });

  it("fecha sin hora: no se corre de día; con hora, la suma en hora argentina", () => {
    expect(textoDeFechaDelEvento(new Date("2026-12-12T00:00:00.000Z"), false)).toBe("sábado 12/12/2026");
    expect(textoDeFechaDelEvento(new Date("2026-12-13T00:30:00.000Z"), true)).toBe("sábado 12/12/2026 · 21:30 h");
  });

  it("respuestas del formulario: lee metaJson.porHoras y tolera basura", () => {
    expect(respuestasDelFormulario({ porHoras: { horas: 2, km: 19.2, segundoFotografo: false } })).toEqual({ horas: 2, km: 19.2, segundoFotografo: false });
    expect(respuestasDelFormulario(null)).toEqual({ horas: null, km: null, segundoFotografo: false });
    expect(respuestasDelFormulario({ porHoras: { horas: "6", km: null, segundoFotografo: "si" } })).toEqual({ horas: null, km: null, segundoFotografo: false });
    expect(respuestasDelFormulario([1])).toEqual({ horas: null, km: null, segundoFotografo: false });
  });
});

describe("aperturas del cliente", () => {
  const a = new Date("2026-11-16T00:40:00.000Z"); // 15/11 21:40 en Argentina
  const b = new Date("2026-11-17T12:12:00.000Z"); // 17/11 09:12

  it("resume cuántas, la primera y la última, sin importar el orden", () => {
    expect(resumirVistas([])).toBeNull();
    expect(resumirVistas([b, a])).toEqual({ veces: 2, primera: a, ultima: b });
  });

  it("textos de la ficha", () => {
    expect(textoDeVistas(null, false)).toBe("Todavía no se envió.");
    expect(textoDeVistas(null, true)).toBe("Todavía no la abrió.");
    expect(textoDeVistas({ veces: 1, primera: a, ultima: a }, true)).toBe("Sí: la abrió 1 vez, el 15/11 21:40.");
    expect(textoDeVistas({ veces: 2, primera: a, ultima: b }, true)).toBe("Sí: la abrió 2 veces. Primera 15/11 21:40, última 17/11 09:12.");
  });

  it("texto corto del listado", () => {
    expect(textoCortoDeVistas(null)).toBeNull();
    expect(textoCortoDeVistas({ veces: 1, primera: a, ultima: a })).toBe("Abierta el 15/11");
    expect(textoCortoDeVistas({ veces: 3, primera: a, ultima: b })).toBe("3 veces · última 17/11");
  });
});

describe("hoja de calendario del encabezado", () => {
  it("fecha sin hora: el día no se corre; con hora, en hora argentina", () => {
    expect(hojaDeCalendario(new Date("2028-07-29T00:00:00.000Z"), false)).toEqual({ ymd: "2028-07-29", diaSemana: "sábado", dia: "29", mes: "jul", anio: "2028", hora: null });
    const h = hojaDeCalendario(new Date("2026-12-13T00:30:00.000Z"), true);
    expect([h.ymd, h.dia, h.mes, h.hora]).toEqual(["2026-12-12", "12", "dic", "21:30 h"]);
  });

  it("cuánto falta", () => {
    expect(textoDeCuantoFalta("2026-11-20", "2026-11-20")).toBe("Es hoy");
    expect(textoDeCuantoFalta("2026-11-21", "2026-11-20")).toBe("Es mañana");
    expect(textoDeCuantoFalta("2026-11-19", "2026-11-20")).toBe("Fue ayer");
    expect(textoDeCuantoFalta("2026-12-20", "2026-11-20")).toBe("Faltan 30 días");
    expect(textoDeCuantoFalta("2026-11-10", "2026-11-20")).toBe("Fue hace 10 días");
  });
});
