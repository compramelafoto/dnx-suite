import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { AVISO_TEXTO_CORTADO, pdfDeCartel, textoDelCartel } from "./cartel";
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

describe("textoDelCartel", () => {
  // Cada carácter mide medio punto por punto de letra.
  const medir = (size: number) => (s: string) => s.length * size * 0.5;
  it("un texto corto crece hasta 26 pt (por la escala) y no se corta", () => {
    const t = textoDelCartel("Breve.", 500, 600, 1, medir);
    expect(t.size).toBe(26);
    expect(t.cortado).toBe(false);
    expect(t.lineas).toEqual(["Breve."]);
    expect(textoDelCartel("Breve.", 500, 600, 2, medir).size).toBe(52);
  });
  it("con más texto, la letra más grande que entra", () => {
    const t = textoDelCartel("palabra ".repeat(200).trim(), 500, 600, 1, medir);
    expect(t.size).toBeGreaterThanOrEqual(11);
    expect(t.size).toBeLessThan(26);
    expect(t.cortado).toBe(false);
    expect(t.altoBloque).toBeLessThanOrEqual(600);
  });
  it("si ni con 11 pt entra, corta con \"…\" y avisa que sigue en la página", () => {
    const t = textoDelCartel("palabra ".repeat(3000).trim(), 500, 600, 1, medir);
    expect(t.size).toBe(11);
    expect(t.cortado).toBe(true);
    expect(t.lineas.at(-1)).toMatch(/…$/);
    expect(t.altoBloque).toBeLessThanOrEqual(600);
    expect(AVISO_TEXTO_CORTADO).toBe("Texto completo en la página de la muestra (QR)");
  });
  it("nunca deja el \"…\" solo en la línea vacía entre párrafos", () => {
    // Párrafos de una línea: el corte cae justo en una línea vacía.
    const parrafos = Array.from({ length: 200 }, (_, i) => `Párrafo ${i}.`).join("\n");
    for (const alto of [100, 117, 130, 150, 171]) {
      const t = textoDelCartel(parrafos, 500, alto, 1, medir);
      expect(t.cortado).toBe(true);
      expect(t.lineas.at(-1)).not.toBe("…");
    }
  });
});
