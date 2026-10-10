import { describe, expect, it } from "vitest";
import { fotoDePortfolioDesdeFormData } from "./mapear";

const BASE = "https://pub-test.r2.dev";
function fd(o: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
}

describe("fotoDePortfolioDesdeFormData", () => {
  it("imagen propia, textos recortados y año válido", () => {
    const f = fotoDePortfolioDesdeFormData(fd({ imageUrl: `${BASE}/muestras/7/abc.webp`, title: "  Río  ", year: "2019", technique: " Giclée ", caption: "" }), BASE, 7);
    expect(f).toEqual({ id: null, imageUrl: `${BASE}/muestras/7/abc.webp`, imagenAjena: false, title: "Río", year: 2019, technique: "Giclée", caption: null });
  });
  it("imagen de otra persona o de otro sitio: ajena", () => {
    for (const url of [`${BASE}/muestras/8/abc.webp`, "https://otro.com/muestras/7/abc.webp", `${BASE}/muestras/7/../8/x.webp`]) {
      const f = fotoDePortfolioDesdeFormData(fd({ imageUrl: url, title: "x" }), BASE, 7);
      expect(f.imageUrl).toBeNull();
      expect(f.imagenAjena).toBe(true);
    }
  });
  it("el super admin acepta las de la dueña del perfil o las suyas", () => {
    expect(fotoDePortfolioDesdeFormData(fd({ imageUrl: `${BASE}/muestras/8/a.webp`, title: "x" }), BASE, [1, 8]).imageUrl).not.toBeNull();
  });
  it("año inválido → null; sin base no se acepta ninguna", () => {
    expect(fotoDePortfolioDesdeFormData(fd({ year: "19x9", title: "x" }), BASE, 7).year).toBeNull();
    expect(fotoDePortfolioDesdeFormData(fd({ imageUrl: `${BASE}/muestras/7/a.webp`, title: "x" }), null, 7).imageUrl).toBeNull();
  });
});
