import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { pdfDeCatalogo } from "./catalogo";
import { MM } from "./dibujo";

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
