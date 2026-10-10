import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { pdfDeCartel } from "./cartel";
import { MM } from "./dibujo";

const datos = {
  titulo: "Miradas del litoral", organizan: "Organiza: Foto Club Rosario", curaduria: "Curaduría: Ana Pérez",
  texto: "Primer párrafo del texto curatorial.\n\nSegundo párrafo.", fechas: "Del 5 al 20 de noviembre de 2026",
  horarios: "Martes a domingo, 15 a 20", lugar: "Centro Cultural, Rosario", url: "https://muestrasfotograficas.com/q/m/cka1",
};
const fecha = new Date("2026-11-01T12:00:00Z");
const medida = async (b: Uint8Array) => {
  const d = await PDFDocument.load(b);
  return [d.getPageCount(), Math.round(d.getPage(0).getWidth() / MM), Math.round(d.getPage(0).getHeight() / MM)];
};

describe("pdfDeCartel", () => {
  it("una página vertical en cada medida", async () => {
    expect(await medida(await pdfDeCartel(datos, "A3", fecha))).toEqual([1, 297, 420]);
    expect(await medida(await pdfDeCartel(datos, "A2", fecha))).toEqual([1, 420, 594]);
    expect(await medida(await pdfDeCartel(datos, "50x70", fecha))).toEqual([1, 500, 700]);
  });
  it("un texto larguísimo no rompe ni agrega páginas; sin texto también sale", async () => {
    expect((await medida(await pdfDeCartel({ ...datos, texto: "Palabra larga. ".repeat(600) }, "A3", fecha)))[0]).toBe(1);
    expect((await medida(await pdfDeCartel({ ...datos, texto: null, organizan: null, curaduria: null, horarios: null, lugar: null }, "A3", fecha)))[0]).toBe(1);
  });
  it("el mismo contenido da los mismos bytes (no se acumulan copias en R2)", async () => {
    const a = await pdfDeCartel(datos, "A3", fecha);
    const b = await pdfDeCartel(datos, "A3", fecha);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });
});
