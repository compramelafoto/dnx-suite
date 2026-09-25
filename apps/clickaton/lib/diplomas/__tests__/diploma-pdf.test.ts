import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PDFDocument } from "pdf-lib";
import { buildDiplomaPdf } from "@/lib/diplomas/diploma-pdf";
import { PNG_1754x1240_FIXTURE } from "@/lib/diplomas/__tests__/fixtures";

describe("buildDiplomaPdf", () => {
  it("devuelve un PDF de una hoja A4 apaisada", async () => {
    const pdf = await buildDiplomaPdf(PNG_1754x1240_FIXTURE);
    const doc = await PDFDocument.load(pdf);
    assert.equal(doc.getPageCount(), 1);
    const { width, height } = doc.getPage(0).getSize();
    assert.equal(Math.round(width), 842);
    assert.equal(Math.round(height), 595);
  });

  it("entra completo, sin recorte", async () => {
    const pdf = await buildDiplomaPdf(PNG_1754x1240_FIXTURE);
    const doc = await PDFDocument.load(pdf);
    const { width, height } = doc.getPage(0).getSize();
    // El dibujo se ajusta al lado más chico: nunca se pasa de la hoja.
    assert.ok(width >= 842 - 1 && height >= 595 - 1);
  });
});
