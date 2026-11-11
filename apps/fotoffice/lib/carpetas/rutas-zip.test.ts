import { describe, expect, it } from "vitest";
import { rutasDeArchivosSueltos, tamanoYAcabado } from "./rutas-zip";

describe("ZIP de archivos sueltos para el laboratorio", () => {
  it("separa tamaño y acabado del nombre del producto", () => {
    expect(tamanoYAcabado("Impresión en plotter 60x100")).toEqual({ tamano: "60x100", acabado: "Impresión en plotter" });
    expect(tamanoYAcabado("Imán 10x15")).toEqual({ tamano: "10x15", acabado: "Imán" });
    expect(tamanoYAcabado("Díptico")).toEqual({ tamano: "Sin medida", acabado: "Díptico" });
  });
  it("Trabajo > Tamaño > Acabado > Copias > nombre original", () => {
    expect(
      rutasDeArchivosSueltos({ numero: "2026-0040", cliente: "Ana Gómez", producto: "Imán 10x15", copias: 3, archivos: [{ id: "a", nombre: "IMG_123.jpg" }] }),
    ).toEqual([{ id: "a", ruta: "Trabajo 2026-0040 - Ana Gómez/10x15/Imán/3 copias/IMG_123.jpg" }]);
  });
  it("una sola copia y nombres con barras", () => {
    expect(rutasDeArchivosSueltos({ numero: "1", cliente: "A/B", producto: null, copias: 1, archivos: [{ id: "a", nombre: "x/y.jpg" }] })[0]!.ruta).toBe(
      "Trabajo 1 - A-B/Sin medida/Trabajo/1 copia/x-y.jpg",
    );
  });
});
