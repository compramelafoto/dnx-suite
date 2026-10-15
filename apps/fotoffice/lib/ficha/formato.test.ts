import { describe, expect, it } from "vitest";
import {
  claseDeColorEtiqueta,
  esFechaSinHora,
  fechaBA,
  fechaDeEvento,
  fechaHoraBA,
  filtrosVisibles,
  tamanoLegible,
  tipoDeArchivo,
} from "./formato";

describe("formato de la ficha", () => {
  it("fecha y hora en Buenos Aires (UTC-3), sin importar la zona del proceso", () => {
    expect(fechaHoraBA("2026-09-30T02:30:00.000Z")).toBe("29/09/2026 23:30");
    expect(fechaHoraBA(new Date("2026-09-30T15:05:00.000Z"))).toBe("30/09/2026 12:05");
    expect(fechaBA("2026-09-30T02:30:00.000Z")).toBe("29/09/2026");
    expect(fechaHoraBA("no es fecha")).toBe("");
  });
  it("tamaño legible", () => {
    expect(tamanoLegible(500)).toBe("500 B");
    expect(tamanoLegible(2048)).toBe("2 KB");
    expect(tamanoLegible(1.5 * 1024 * 1024)).toBe("1,5 MB");
  });
  it("color de etiqueta desconocido se ve gris", () => {
    expect(claseDeColorEtiqueta("rojo")).toContain("red");
    expect(claseDeColorEtiqueta("fucsia")).toBe(claseDeColorEtiqueta("gris"));
  });
  it("Plata sólo con verDinero", () => {
    expect(filtrosVisibles(true).map((f) => f.texto)).toEqual(["Todo", "Notas", "Cambios", "Mensajes", "Plata", "Portal", "Carnets", "Adjuntos"]);
    expect(filtrosVisibles(false).map((f) => f.texto)).not.toContain("Plata");
    expect(filtrosVisibles(false)[0]).toEqual({ valor: null, texto: "Todo" });
  });
  it("tipo de archivo: el declarado, o el de la extensión si no hay", () => {
    expect(tipoDeArchivo("dni.pdf", "application/pdf")).toBe("application/pdf");
    expect(tipoDeArchivo("foto.HEIC", "")).toBe("image/heic");
    expect(tipoDeArchivo("raro.exe", "")).toBe("");
  });
});

describe("fechaDeEvento", () => {
  it("medianoche UTC es una fecha de calendario: el día elegido, no el anterior", () => {
    // Lo que guarda el formulario público: `new Date("2026-12-20")`.
    expect(fechaBA(new Date("2026-12-20"))).toBe("19/12/2026"); // el error que se veía
    expect(fechaDeEvento(new Date("2026-12-20"))).toBe("20/12/2026");
    expect(fechaDeEvento("2026-12-20T00:00:00.000Z")).toBe("20/12/2026"); // la ficha la recibe como texto ISO
    expect(fechaDeEvento(new Date("2027-01-01"))).toBe("01/01/2027");
  });
  it("cualquier otro instante se muestra en hora de Buenos Aires", () => {
    expect(fechaDeEvento(new Date("2026-12-21T02:00:00.000Z"))).toBe("20/12/2026");
    expect(fechaDeEvento(new Date("2026-12-20T15:00:00.000Z"))).toBe("20/12/2026");
    expect(fechaDeEvento(new Date("2026-12-20T00:00:00.001Z"))).toBe("19/12/2026");
  });
  it("una fecha inválida da texto vacío", () => {
    expect(fechaDeEvento("no-es-fecha")).toBe("");
  });
  it("esFechaSinHora sólo con 00:00:00.000 UTC exacto", () => {
    expect(esFechaSinHora(new Date("2026-12-20"))).toBe(true);
    expect(esFechaSinHora(new Date("2026-12-20T03:00:00Z"))).toBe(false);
  });
});
