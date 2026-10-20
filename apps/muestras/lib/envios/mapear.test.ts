import { describe, expect, it } from "vitest";
import { envioDesdeFormData, esImagenDeUsuario } from "./mapear";

const base = "https://pub-test.r2.dev";

function fd(o: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
}

describe("imagen de la persona", () => {
  it("acepta sólo lo que subió ella", () => {
    expect(esImagenDeUsuario(`${base}/muestras/7/a.webp`, base, 7)).toBe(true);
    expect(esImagenDeUsuario(`${base}/muestras/7/a.jpg`, base, 7)).toBe(false);
    expect(esImagenDeUsuario(`${base}/muestras/7/x/a.webp`, base, 7)).toBe(false);
    expect(esImagenDeUsuario(`${base}/muestras/70/a.webp`, base, 7)).toBe(false);
    expect(esImagenDeUsuario(`${base}/muestras/8/a.webp`, base, 7)).toBe(false);
    expect(esImagenDeUsuario(`${base}/muestras/7/../8/a.webp`, base, 7)).toBe(false);
    expect(esImagenDeUsuario("https://otro.com/muestras/7/a.webp", base, 7)).toBe(false);
    expect(esImagenDeUsuario(`${base}/muestras/7/a.webp`, null, 7)).toBe(false);
  });
});

describe("envío desde el formulario", () => {
  it("lee obras y aceptaciones, descarta imágenes ajenas y años raros", () => {
    const works = JSON.stringify([
      { imageUrl: `${base}/muestras/7/a.webp`, title: " Puerto ", year: 2024, technique: "Digital", statement: "Texto" },
      { imageUrl: `${base}/muestras/9/b.webp`, title: "Ajena" },
      { imageUrl: `${base}/muestras/7/c.webp`, title: "Vieja", year: 1500 },
    ]);
    const e = envioDesdeFormData(fd({ callId: "c1", authorName: "Ana Pérez", basesAccepted: "on", works }), 7, base);
    expect(e.basesAccepted).toBe(true);
    expect(e.rightsAccepted).toBe(false);
    expect(e.works).toEqual([
      { imageUrl: `${base}/muestras/7/a.webp`, title: "Puerto", year: 2024, technique: "Digital", statement: "Texto" },
      { imageUrl: `${base}/muestras/7/c.webp`, title: "Vieja", year: null, technique: null, statement: null },
    ]);
  });
  it("recorta los textos a sus límites", () => {
    const works = JSON.stringify([{ imageUrl: `${base}/muestras/7/a.webp`, title: "x".repeat(500), statement: "y".repeat(2000) }]);
    const e = envioDesdeFormData(fd({ callId: "c1", authorName: "z".repeat(900), works }), 7, base);
    expect(e.works[0].title).toHaveLength(200);
    expect(e.works[0].statement).toHaveLength(600);
    expect(e.authorName).toHaveLength(200);
  });
  it("un JSON roto es una lista vacía", () => {
    expect(envioDesdeFormData(fd({ callId: "c1", works: "{" }), 7, base).works).toEqual([]);
  });
});
