import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { pdfDeCatalogo, renglonesDelIndice } from "./catalogo";
import { MM } from "./dibujo";
import { obraDeCatalogo } from "./textos";

const foto = async () => ({
  jpg: new Uint8Array(await sharp({ create: { width: 120, height: 80, channels: 3, background: "#777777" } }).jpeg().toBuffer()),
  width: 120, height: 80,
});
const base = async () => ({
  titulo: "Miradas del litoral", organizan: "Organiza: Foto Club", curaduria: "Curaduría: Ana Pérez", texto: null as string | null,
  fechas: "Del 5 al 20 de noviembre de 2026", horarios: null, lugar: "Rosario", url: "https://muestrasfotograficas.com/q/m/cka1",
  urlVisible: "muestrasfotograficas.com/m/miradas", portada: await foto(),
  obras: [
    { titulo: "Uno", autor: "Zoe Ruiz", detalle: "2025", imagen: await foto() },
    { titulo: "Dos", autor: "Ana Pérez", detalle: null, imagen: null },
    { titulo: "Tres", autor: "", detalle: null, imagen: await foto() },
  ],
});
const fecha = new Date("2026-11-01T12:00:00Z");

describe("pdfDeCatalogo", () => {
  it("sin texto curatorial: portada, tres obras, índice y cierre", async () => {
    const doc = await PDFDocument.load(await pdfDeCatalogo(await base(), "A5", fecha));
    expect(doc.getPageCount()).toBe(6);
    expect([Math.round(doc.getPage(0).getWidth() / MM), Math.round(doc.getPage(0).getHeight() / MM)]).toEqual([148, 210]);
  });
  it("un texto curatorial largo ocupa varias páginas y corre todo lo demás", async () => {
    const d = { ...(await base()), texto: Array.from({ length: 30 }, (_, i) => `Párrafo ${i + 1}. ${"Texto del recorrido curatorial. ".repeat(8)}`).join("\n\n") };
    const doc = await PDFDocument.load(await pdfDeCatalogo(d, "A5", fecha));
    expect(doc.getPageCount()).toBeGreaterThan(7);
  });
  it("A4", async () => {
    const doc = await PDFDocument.load(await pdfDeCatalogo(await base(), "A4", fecha));
    expect([Math.round(doc.getPage(3).getWidth() / MM), Math.round(doc.getPage(3).getHeight() / MM)]).toEqual([210, 297]);
  });
  it("sin obras no hay catálogo", async () => {
    await expect(pdfDeCatalogo({ ...(await base()), obras: [] }, "A5", fecha)).rejects.toThrow("No hay obras");
  });
});

describe("índice de autores", () => {
  const medir = (s: string) => s.length * 5;
  it("25 obras del mismo autor: un solo renglón con el rango", () => {
    const r = renglonesDelIndice([{ author: "Ana Pérez", pages: Array.from({ length: 25 }, (_, i) => i + 3) }], 300, 10, medir);
    expect(r).toEqual([{ autor: "Ana Pérez", paginas: "3–27" }]);
  });
  it("páginas salteadas que no entran al lado del nombre pasan a renglones propios, cortados", () => {
    const pages = Array.from({ length: 25 }, (_, i) => 3 + i * 2);
    const r = renglonesDelIndice([{ author: "Ana Pérez", pages }, { author: "Zoe Ruiz", pages: [4] }], 300, 10, medir);
    expect(r[0]).toEqual({ autor: "Ana Pérez", paginas: null });
    const sueltas = r.filter((x) => x.autor === null);
    expect(sueltas.length).toBeGreaterThan(1);
    for (const x of sueltas) expect(medir(x.paginas!)).toBeLessThanOrEqual(290);
    expect(sueltas.map((x) => x.paginas).join(" ")).toBe(pages.join(", "));
    expect(r.at(-1)).toEqual({ autor: "Zoe Ruiz", paginas: "4" });
  });
  it("un catálogo de un solo autor con 25 obras y créditos de curaduría largos sale entero", async () => {
    const b = await base();
    const img = await foto();
    const d = {
      ...b,
      texto: "Un recorrido por el río.",
      curaduria: `Curaduría: ${"Ana Pérez, Juan Gómez y el equipo del Foto Club Rosario con la colaboración de muchas personas. ".repeat(40)}`,
      obras: Array.from({ length: 25 }, (_, i) => ({ titulo: `Obra ${i + 1}`, autor: "Zoe Ruiz", detalle: null, imagen: img })),
    };
    const doc = await PDFDocument.load(await pdfDeCatalogo(d, "A5", fecha));
    // Portada, 2 páginas de texto (la curaduría larga se corta y sigue), 25 obras, índice y cierre.
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(30);
  });
  it("con la misma fecha, los mismos bytes", async () => {
    const d = await base();
    const a = await pdfDeCatalogo(d, "A5", fecha);
    const b2 = await pdfDeCatalogo(d, "A5", fecha);
    expect(Buffer.from(a).equals(Buffer.from(b2))).toBe(true);
  });
});

describe("obras de expositores en el catálogo (etapa 6)", () => {
  const ex = { imageWidthCm: 40, imageHeightCm: 60.5, edition: "LIMITED", editionNumber: 2, editionSize: 10, statement: "Una serie sobre el río.", priceArs: 120000 };
  it("suma medidas, edición y el texto de la obra; el texto armado no contiene el precio", () => {
    const o = obraDeCatalogo({ title: "Silos", authorName: "Ema", year: 2024, technique: "Giclée" }, ex);
    expect(o).toEqual({ titulo: "Silos", autor: "Ema", detalle: "2024. Giclée. 40 × 60,5 cm. Edición 2/10", texto: "Una serie sobre el río." });
    expect(JSON.stringify(o)).not.toMatch(/120[.]?000/);
  });
  it("sin datos de expositor, como antes", () => {
    expect(obraDeCatalogo({ title: "T", authorName: "A", year: 2020, technique: null })).toEqual({ titulo: "T", autor: "A", detalle: "2020", texto: null });
  });
  it("el PDF se arma con el texto de la obra", async () => {
    const d = await base();
    const primera = { ...d.obras[0]!, ...obraDeCatalogo({ title: "Uno", authorName: "Zoe Ruiz", year: 2025, technique: "Giclée" }, { ...ex, statement: "Texto largo. ".repeat(80) }) };
    const doc = await PDFDocument.load(await pdfDeCatalogo({ ...d, obras: [primera, ...d.obras.slice(1)] }, "A5", fecha));
    expect(doc.getPageCount()).toBe(6);
  });
});
