import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { MM } from "./dibujo";
import { pdfDeMontaje } from "./montaje";
import { datosDeMontaje } from "./textos";

const obras = Array.from({ length: 16 }, (_, i) => ({ id: `w${i + 1}`, title: `Obra ${i + 1}`, authorName: i % 2 ? "Ana Pérez" : "" }));
const fecha = new Date("2026-11-01T12:00:00Z");

describe("pdfDeMontaje", () => {
  it("A4 apaisado: una o más páginas por pared y la lista de control al final", async () => {
    const plan = {
      version: 1 as const, centerHeightCm: 150,
      walls: [
        { id: "a", name: "Norte", widthCm: 1500, heightCm: 300, items: obras.slice(0, 14).map((o) => ({ workId: o.id, frameWidthCm: 40, frameHeightCm: 50 })) },
        { id: "b", name: "Sur", widthCm: 200, heightCm: null, items: [{ workId: "w15", frameWidthCm: 250, frameHeightCm: 50 }] },
      ],
    };
    const doc = await PDFDocument.load(await pdfDeMontaje(datosDeMontaje("Miradas", plan, obras), fecha));
    expect([Math.round(doc.getPage(0).getWidth() / MM), Math.round(doc.getPage(0).getHeight() / MM)]).toEqual([297, 210]);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(4);
  });
  it("sin paredes, una página con las obras sin asignar", async () => {
    const doc = await PDFDocument.load(await pdfDeMontaje(datosDeMontaje("M", { version: 1, centerHeightCm: 150, walls: [] }, obras.slice(0, 2)), fecha));
    expect(doc.getPageCount()).toBe(1);
  });
});
