import { describe, expect, it } from "vitest";
import { claveDeArchivo, limpiarNombreArchivo, nuevoVencimiento, tamanoLegible, tipoDeArchivo } from "./reglas";

describe("limpiarNombreArchivo", () => {
  it("saca rutas y caracteres raros, conserva la extensión", () => {
    expect(limpiarNombreArchivo("C:\\fotos\\IMG 0001.JPG")).toBe("IMG 0001.JPG");
    expect(limpiarNombreArchivo('ma"la<cosa>.tif')).toBe("malacosa.tif");
    expect(limpiarNombreArchivo("..")).toBe("archivo");
  });
});

describe("tipoDeArchivo", () => {
  it("acepta un tipo bien formado y si no, genérico", () => {
    expect(tipoDeArchivo("image/TIFF")).toBe("image/tiff");
    expect(tipoDeArchivo("")).toBe("application/octet-stream");
    expect(tipoDeArchivo("<script>")).toBe("application/octet-stream");
  });
});

describe("claveDeArchivo", () => {
  it("queda dentro de la carpeta del trabajo y sin espacios", () => {
    expect(claveDeArchivo("ws", "pr", "ar", "Mi foto 1.jpg")).toBe("trabajos/ws/pr/ar/Mi_foto_1.jpg");
  });
});

describe("nuevoVencimiento", () => {
  const ahora = new Date("2026-10-18T12:00:00Z");
  it("30 días desde hoy", () => {
    expect(nuevoVencimiento(null, ahora).toISOString()).toBe("2026-11-17T12:00:00.000Z");
  });
  it("nunca acorta uno más largo", () => {
    const lejos = new Date("2027-01-01T00:00:00Z");
    expect(nuevoVencimiento(lejos, ahora)).toBe(lejos);
  });
});

describe("tamanoLegible", () => {
  it("en la unidad que corresponde", () => {
    expect(tamanoLegible(512)).toBe("512 B");
    expect(tamanoLegible(3 * 1024 ** 2)).toBe("3,0 MB");
    expect(tamanoLegible(2.5 * 1024 ** 3)).toBe("2,50 GB");
  });
});
