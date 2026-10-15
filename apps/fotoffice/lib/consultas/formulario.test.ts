import { describe, expect, it } from "vitest";
import { diaDeFecha, eventoDelFormulario, fechaDeCalendario, formularioDelEvento, numeroDeTexto } from "./formulario";

describe("formulario de Consultas (puro)", () => {
  it("fecha de calendario: medianoche UTC; inválidas = undefined; vacía = null", () => {
    expect(fechaDeCalendario("2026-12-20")!.toISOString()).toBe("2026-12-20T00:00:00.000Z");
    expect(fechaDeCalendario("")).toBeNull();
    expect(fechaDeCalendario(undefined)).toBeNull();
    expect(fechaDeCalendario("2026-02-30")).toBeUndefined();
    expect(fechaDeCalendario("20/12/2026")).toBeUndefined();
    expect(fechaDeCalendario(5)).toBeUndefined();
  });

  it("números a la argentina", () => {
    expect(numeroDeTexto("150.000")).toBe(150000);
    expect(numeroDeTexto("1.234,50")).toBe(1234.5);
    expect(numeroDeTexto("$ 2500")).toBe(2500);
    expect(numeroDeTexto("2500.5")).toBe(2500.5);
    expect(numeroDeTexto("")).toBeNull();
    expect(numeroDeTexto("-3")).toBeUndefined();
    expect(numeroDeTexto("mucho")).toBeUndefined();
  });

  it("el evento sólo lleva los campos del grupo; con hora es hora de Buenos Aires", () => {
    const f = { fecha: "2026-12-20", hora: "21:30", invitados: "100", lugar: "Hotel", novio1: "A", ciudad: "Rosario" };
    const boda = eventoDelFormulario("BODA", f);
    expect(boda.ok && boda.evento.startsAt!.toISOString()).toBe("2026-12-21T00:30:00.000Z");
    expect(boda.ok && boda.evento).toMatchObject({ horaConocida: true, guests: 100, partnerOneName: "A", partnerTwoName: null, city: "Rosario" });
    expect(boda.ok && "venue" in boda.evento).toBe(false);
    const sinFecha = eventoDelFormulario("TRABAJO_SIN_FECHA", f);
    expect(sinFecha.ok && sinFecha.evento).toEqual({});
    const sinHora = eventoDelFormulario("TRABAJO_CON_FECHA", { fecha: "2026-12-20" });
    expect(sinHora.ok && sinHora.evento).toEqual({ startsAt: new Date("2026-12-20T00:00:00.000Z"), horaConocida: false, venue: null });
    expect(eventoDelFormulario("EVENTO", { fecha: "2026-13-01" })).toEqual({ ok: false, error: "fecha" });
    expect(eventoDelFormulario("EVENTO", { invitados: "2,5" })).toEqual({ ok: false, error: "invitados" });
  });

  it("de lo guardado al formulario, con la regla de fechas del PR 402", () => {
    expect(diaDeFecha(new Date("2026-12-20T00:00:00.000Z"))).toBe("2026-12-20");
    expect(diaDeFecha(new Date("2026-12-21T00:30:00.000Z"))).toBe("2026-12-20");
    const f = formularioDelEvento({
      startsAt: "2026-12-21T00:30:00.000Z", horaConocida: true, guests: 80, partnerOneName: null, partnerTwoName: null,
      ceremonyVenue: null, receptionVenue: null, venue: "Hotel", city: null,
    });
    expect(f).toMatchObject({ fecha: "2026-12-20", hora: "21:30", invitados: "80", lugar: "Hotel", ciudad: "" });
  });
});
