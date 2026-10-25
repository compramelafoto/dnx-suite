import { describe, expect, it } from "vitest";
import {
  ERR_CSV_PESADO,
  ERR_CSV_TIPO,
  ERR_PDF_PESADO,
  ERR_TIPO,
  MAX_BYTES_PDF,
  clasificarArchivo,
  medidasReducidas,
  mensajeResultado,
  validarCsv,
} from "./archivo-cliente";

const MB = 1024 * 1024;

describe("clasificarArchivo", () => {
  it("fotos por tipo o por extensión (HEIC del iPhone sin tipo)", () => {
    expect(clasificarArchivo({ name: "a.jpg", type: "image/jpeg", size: 9 * MB })).toEqual({ ok: true, clase: "imagen" });
    expect(clasificarArchivo({ name: "IMG_1.HEIC", type: "", size: 3 * MB })).toEqual({ ok: true, clase: "imagen" });
    // La foto no tiene tope acá: se achica antes de mandarla.
    expect(clasificarArchivo({ name: "x.png", type: "image/png", size: 40 * MB })).toEqual({ ok: true, clase: "imagen" });
  });

  it("PDF hasta el tope; más pesado, rechazado con el mensaje", () => {
    expect(clasificarArchivo({ name: "f.pdf", type: "application/pdf", size: MAX_BYTES_PDF })).toEqual({ ok: true, clase: "pdf" });
    expect(clasificarArchivo({ name: "f.PDF", type: "", size: MAX_BYTES_PDF + 1 })).toEqual({ ok: false, error: ERR_PDF_PESADO });
    expect(clasificarArchivo({ name: "f.pdf", type: "application/pdf", size: 5 * MB })).toEqual({ ok: false, error: ERR_PDF_PESADO });
  });

  it("el tope del PDF queda debajo de los 4 MB de la acción", () => {
    expect(MAX_BYTES_PDF).toBeLessThan(4 * MB);
    expect(MAX_BYTES_PDF).toBeGreaterThan(3.5 * MB);
  });

  it("otros archivos, rechazados", () => {
    expect(clasificarArchivo({ name: "f.docx", type: "application/msword", size: 10 })).toEqual({ ok: false, error: ERR_TIPO });
  });
});

describe("validarCsv", () => {
  it("acepta .csv o text/plain hasta 1 MB", () => {
    expect(validarCsv({ name: "a.csv", type: "", size: MB })).toEqual({ ok: true });
    expect(validarCsv({ name: "a.txt", type: "text/plain", size: 10 })).toEqual({ ok: true });
  });
  it("rechaza pesado o de otro tipo", () => {
    expect(validarCsv({ name: "a.csv", type: "text/csv", size: MB + 1 })).toEqual({ ok: false, error: ERR_CSV_PESADO });
    expect(validarCsv({ name: "a.xlsx", type: "application/vnd.ms-excel", size: 10 })).toEqual({ ok: false, error: ERR_CSV_TIPO });
  });
});

describe("medidasReducidas", () => {
  it("no agranda una foto chica", () => {
    expect(medidasReducidas(800, 600)).toEqual({ ancho: 800, alto: 600 });
    expect(medidasReducidas(2000, 1000)).toEqual({ ancho: 2000, alto: 1000 });
  });
  it("lleva el lado mayor a 2000 conservando la proporción", () => {
    expect(medidasReducidas(4032, 3024)).toEqual({ ancho: 2000, alto: 1500 });
    expect(medidasReducidas(3024, 4032)).toEqual({ ancho: 1500, alto: 2000 });
  });
  it("una tira muy angosta no queda en 0 px", () => {
    expect(medidasReducidas(10000, 1)).toEqual({ ancho: 2000, alto: 1 });
  });
  it("respeta otro máximo", () => {
    expect(medidasReducidas(1000, 500, 100)).toEqual({ ancho: 100, alto: 50 });
  });
});

describe("mensajeResultado", () => {
  it("líneas y sin asociar", () => {
    expect(mensajeResultado({ agregadas: 5, sinAsociar: 2, corregidas: 0, descartadas: 0 })).toBe(
      "Se agregaron 5 líneas (2 sin asociar).",
    );
    expect(mensajeResultado({ agregadas: 1, sinAsociar: 0, corregidas: 0, descartadas: 0 })).toBe(
      "Se agregó 1 línea (0 sin asociar).",
    );
  });
  it("menciona las cantidades corregidas y las filas descartadas", () => {
    expect(mensajeResultado({ agregadas: 3, sinAsociar: 0, corregidas: 2, descartadas: 1 })).toBe(
      "Se agregaron 3 líneas (0 sin asociar). 2 cantidades se llevaron a 1: revisalas. 1 fila sin descripción no se cargó.",
    );
  });
});
