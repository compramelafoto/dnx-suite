import { PDFDocument, PDFPage } from "pdf-lib";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { MM } from "./dibujo";
import { pdfDeMarcos } from "./marco";

const foto = async (width: number, height: number) => ({
  jpg: new Uint8Array(await sharp({ create: { width, height, channels: 3, background: "#777777" } }).jpeg().toBuffer()),
  width, height,
});
const paginas = async (bytes: Uint8Array) => {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((p) => [Math.round(p.getWidth() / MM), Math.round(p.getHeight() / MM)]);
};
const fecha = new Date("2026-11-01T12:00:00Z");

describe("pdfDeMarcos", () => {
  it("una página por obra, orientada según su foto", async () => {
    const obras = [
      { titulo: "El río", autor: "Ana Pérez", detalle: "2025", imagen: await foto(300, 200) },
      { titulo: "La torre", autor: "Luis Gil", detalle: null, imagen: await foto(200, 300) },
    ];
    expect(await paginas(await pdfDeMarcos("Miradas", obras, { tamano: "A4", orientacion: "AUTO", conFoto: true }, fecha))).toEqual([[297, 210], [210, 297]]);
  });
  it("orientación forzada y medidas grandes", async () => {
    const obras = [{ titulo: "El río", autor: "Ana", detalle: null, imagen: await foto(300, 200) }];
    expect(await paginas(await pdfDeMarcos("M", obras, { tamano: "50x70", orientacion: "PORTRAIT", conFoto: true }, fecha))).toEqual([[500, 700]]);
  });
  it("sólo el remarco: sin foto, más liviano, y sin imagen disponible también sale", async () => {
    const obras = [{ titulo: "El río", autor: "Ana", detalle: null, imagen: await foto(300, 200) }];
    const con = await pdfDeMarcos("M", obras, { tamano: "A3", orientacion: "AUTO", conFoto: true }, fecha);
    const sin = await pdfDeMarcos("M", obras, { tamano: "A3", orientacion: "AUTO", conFoto: false }, fecha);
    expect(sin.byteLength).toBeLessThan(con.byteLength);
    const rota = [{ titulo: "Sin foto", autor: "Łukasz 📷", detalle: null, imagen: null }];
    expect(await paginas(await pdfDeMarcos("M", rota, { tamano: "A4", orientacion: "AUTO", conFoto: true }, fecha))).toEqual([[210, 297]]);
  });
  it("sin autor, el pie dice \"Autor sin indicar\"", async () => {
    const espia = vi.spyOn(PDFPage.prototype, "drawText");
    const obras = [{ titulo: "El río", autor: "   ", detalle: null, imagen: null }];
    await pdfDeMarcos("M", obras, { tamano: "A4", orientacion: "AUTO", conFoto: false }, fecha);
    expect(espia.mock.calls.map((c) => c[0])).toContain("Autor sin indicar");
    espia.mockRestore();
  });
  it("con la misma fecha, los mismos bytes", async () => {
    const obras = [{ titulo: "El río", autor: "Ana", detalle: null, imagen: await foto(300, 200) }];
    const a = await pdfDeMarcos("M", obras, { tamano: "A4", orientacion: "AUTO", conFoto: true }, fecha);
    const b = await pdfDeMarcos("M", obras, { tamano: "A4", orientacion: "AUTO", conFoto: true }, fecha);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });
  it("sin obras no hay PDF", async () => {
    await expect(pdfDeMarcos("M", [], { tamano: "A4", orientacion: "AUTO", conFoto: true }, fecha)).rejects.toThrow("No hay obras");
  });
});
