import { describe, expect, it } from "vitest";
import {
  claseDeColorEtiqueta,
  fechaBA,
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
    expect(filtrosVisibles(true).map((f) => f.texto)).toEqual(["Todo", "Notas", "Cambios", "Plata", "Portal", "Carnets", "Adjuntos"]);
    expect(filtrosVisibles(false).map((f) => f.texto)).not.toContain("Plata");
    expect(filtrosVisibles(false)[0]).toEqual({ valor: null, texto: "Todo" });
  });
  it("tipo de archivo: el declarado, o el de la extensión si no hay", () => {
    expect(tipoDeArchivo("dni.pdf", "application/pdf")).toBe("application/pdf");
    expect(tipoDeArchivo("foto.HEIC", "")).toBe("image/heic");
    expect(tipoDeArchivo("raro.exe", "")).toBe("");
  });
});
