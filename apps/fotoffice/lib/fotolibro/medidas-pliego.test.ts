import { describe, expect, it } from "vitest";
import {
  MEDIDAS_PLIEGO,
  describirCerrado,
  lienzoDelPliego,
  medidaPorId,
  medidasDelProveedor,
  paginaCerrada,
} from "./medidas-pliego";

describe("medidas de pliego", () => {
  it("no repite ids", () => {
    const ids = MEDIDAS_PLIEGO.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("el 30x45 de hojas rígidas es la copia de 305 × 457 mm", () => {
    const m = medidaPorId("rigido-30x45");
    expect(m).toMatchObject({ altoMm: 305, anchoMm: 457 });
  });

  it("la tapa flexible sale más larga que la rígida", () => {
    expect(medidaPorId("flexible-20x30")?.anchoMm).toBe(310);
    expect(medidaPorId("rigido-20x30")?.anchoMm).toBe(305);
  });

  it("deduce la página del libro cerrado", () => {
    expect(paginaCerrada(medidaPorId("rigido-20x30")!).orientacion).toBe("VERTICAL");
    expect(paginaCerrada(medidaPorId("rigido-30x60")!).orientacion).toBe("CUADRADO");
    expect(paginaCerrada(medidaPorId("rigido-20x40")!).orientacion).toBe("CUADRADO");
    expect(paginaCerrada(medidaPorId("rigido-30x90")!).orientacion).toBe("HORIZONTAL");
    expect(describirCerrado(medidaPorId("rigido-30x45")!)).toBe("30,5 × 22,85 cm, vertical");
  });

  it("arma el lienzo a 300 dpi, apaisado", () => {
    expect(lienzoDelPliego(medidaPorId("rigido-30x60")!)).toEqual({ width: 7205, height: 3602 });
  });

  it("reconoce al proveedor sin importar tildes ni mayúsculas", () => {
    expect(medidasDelProveedor("Román")?.some((x) => x.linea === "FLEXIBLE")).toBe(false);
    expect(medidasDelProveedor("  COPY   express ")?.length).toBeGreaterThan(10);
    expect(medidasDelProveedor("Fotolag")).toBeNull();
  });
});
