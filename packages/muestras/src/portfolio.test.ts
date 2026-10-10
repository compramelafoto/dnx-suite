import { describe, expect, it } from "vitest";
import { portfolioPhotoProblems, portfolioPreview } from "./portfolio";

const base = { imageUrl: "https://r2/muestras/7/p.webp", title: "Niebla", year: 2023, exhibitedUrls: new Set<string>(), count: 0, isNew: true };

describe("foto del portfolio", () => {
  it("todo bien", () => expect(portfolioPhotoProblems(base)).toEqual([]));
  it("título obligatorio, año razonable, tope de 60 al sumar", () => {
    expect(portfolioPhotoProblems({ ...base, title: " " })).toEqual(["Cada foto del portfolio necesita un título."]);
    expect(portfolioPhotoProblems({ ...base, year: 1700 })).toEqual(["Revisá el año."]);
    expect(portfolioPhotoProblems({ ...base, count: 60 })).toEqual(["El portfolio admite hasta 60 fotos."]);
    expect(portfolioPhotoProblems({ ...base, count: 60, isNew: false })).toEqual([]);
  });
  it("una obra expuesta no puede ir al portfolio", () => {
    expect(portfolioPhotoProblems({ ...base, exhibitedUrls: new Set([base.imageUrl]) }))
      .toEqual(["Esa foto es una obra que expusiste o vas a exponer: no la sumes al portfolio, así sigue siendo sorpresa en la sala."]);
  });
  it("vista previa: las primeras 8 en orden", () => {
    const fotos = Array.from({ length: 10 }, (_, i) => ({ id: `f${i}`, sortOrder: 9 - i }));
    expect(portfolioPreview(fotos).map((f) => f.id)).toEqual(["f9", "f8", "f7", "f6", "f5", "f4", "f3", "f2"]);
  });
});
