import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { MM, pdfDeFichas, tramosOscuros } from "./pdf";

const ficha = {
  muestra: "Miradas del litoral", titulo: "El río a la siesta", autor: "Ana Pérez",
  detalle: "2025. Copia pigmentaria", url: "https://muestrasfotograficas.com/m/miradas-abc123/o/w1",
};
const medidas = async (bytes: Uint8Array) => {
  const doc = await PDFDocument.load(bytes);
  const { width, height } = doc.getPage(0).getSize();
  return { paginas: doc.getPageCount(), ancho: Math.round(width / MM), alto: Math.round(height / MM) };
};

describe("pdfDeFichas", () => {
  it("una página A6 por obra", async () => {
    expect(await medidas(await pdfDeFichas([ficha, { ...ficha, titulo: "Otra" }], "A6"))).toEqual({ paginas: 2, ancho: 105, alto: 148 });
  });
  it("A5", async () => {
    expect(await medidas(await pdfDeFichas([ficha], "A5"))).toEqual({ paginas: 1, ancho: 148, alto: 210 });
  });
  it("aguanta textos largos y caracteres que la fuente no tiene", async () => {
    const raro = { ...ficha, titulo: "Un título larguísimo ".repeat(12), autor: "Łukasz 📷" };
    await expect(pdfDeFichas([raro], "A6")).resolves.toBeInstanceOf(Uint8Array);
  });
  it("sin obras no hay PDF", async () => {
    await expect(pdfDeFichas([], "A6")).rejects.toThrow("No hay obras");
  });
});

describe("tramosOscuros", () => {
  it("junta los módulos negros seguidos de cada fila en un solo rectángulo", () => {
    const m = [
      [true, true, false, true],
      [false, false, false, false],
      [true, true, true, true],
    ];
    expect(tramosOscuros(m)).toEqual([
      { fila: 0, col: 0, largo: 2 },
      { fila: 0, col: 3, largo: 1 },
      { fila: 2, col: 0, largo: 4 },
    ]);
  });
  it("cubre exactamente los mismos módulos que la matriz", () => {
    const m = Array.from({ length: 25 }, (_, f) => Array.from({ length: 25 }, (_, c) => (f * 7 + c * 13) % 5 < 2));
    const pintados = new Set<string>();
    for (const t of tramosOscuros(m)) for (let c = t.col; c < t.col + t.largo; c++) pintados.add(`${t.fila},${c}`);
    const negros = m.flatMap((fila, f) => fila.flatMap((v, c) => (v ? [`${f},${c}`] : [])));
    expect([...pintados].sort()).toEqual(negros.sort());
  });
});
