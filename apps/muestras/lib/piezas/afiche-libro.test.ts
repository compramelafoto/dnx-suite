import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { pdfDeAficheLibro } from "./afiche-libro";
import { MM } from "./dibujo";

describe("pdfDeAficheLibro", () => {
  it("una página en A4 y en A3", async () => {
    const d = { muestra: "Miradas del litoral", url: "https://muestrasfotograficas.com/q/l/cka1", urlVisible: "muestrasfotograficas.com/m/miradas/libro" };
    for (const [t, w, h] of [["A4", 210, 297], ["A3", 297, 420]] as const) {
      const doc = await PDFDocument.load(await pdfDeAficheLibro(d, t, new Date("2026-11-01T12:00:00Z")));
      expect([doc.getPageCount(), Math.round(doc.getPage(0).getWidth() / MM), Math.round(doc.getPage(0).getHeight() / MM)]).toEqual([1, w, h]);
    }
  });
});
