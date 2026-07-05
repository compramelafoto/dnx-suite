import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";
import { parseHexColor, buildPdfDocumentColors } from "./colors";
import { createPdfDocumentContext } from "./context";
import { addPage, drawText, ensureSpace, moveY } from "./layout";
import { resolvePdfLogo } from "./logo";
import { commercialInitialsFromLabel, wrapTextByWidth } from "./text";

describe("parseHexColor", () => {
  it("convierte hex de 6 dígitos a rgb normalizado", () => {
    const color = parseHexColor("#16a34a");
    expect(color.red).toBeCloseTo(0.086, 2);
    expect(color.green).toBeCloseTo(0.639, 2);
    expect(color.blue).toBeCloseTo(0.29, 2);
  });

  it("acepta hex corto y valores inválidos con fallback", () => {
    const short = parseHexColor("#fff");
    expect(short.red).toBeCloseTo(1, 2);

    const invalid = parseHexColor("not-a-color");
    expect(invalid.red).toBeCloseTo(0.09, 2);
  });
});

describe("buildPdfDocumentColors", () => {
  it("usa acento del fotógrafo cuando está presente", () => {
    const colors = buildPdfDocumentColors("#2563eb");
    expect(colors.accentColorHex).toBe("#2563eb");
    expect(colors.accent.blue).toBeGreaterThan(colors.accent.red);
  });
});

describe("wrapTextByWidth", () => {
  it("envuelve por ancho real de fuente", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const lines = wrapTextByWidth(
      "Cobertura fotográfica completa del evento con edición profesional incluida",
      font,
      10,
      180,
    );

    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(font.widthOfTextAtSize(line, 10)).toBeLessThanOrEqual(180.5);
    }
  });

  it("respeta saltos de línea explícitos", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const lines = wrapTextByWidth("Primera línea\nSegunda línea", font, 10, 400);
    expect(lines).toEqual(["Primera línea", "Segunda línea"]);
  });
});

describe("PdfDocumentContext layout", () => {
  it("moveY reduce cursorY", async () => {
    const ctx = await createPdfDocumentContext();
    const initialY = ctx.cursorY;
    moveY(ctx, 20);
    expect(ctx.cursorY).toBe(initialY - 20);
  });

  it("ensureSpace agrega página cuando no hay espacio", async () => {
    const ctx = await createPdfDocumentContext({ margin: 48 });
    ctx.cursorY = ctx.margin + 10;
    ensureSpace(ctx, 40);
    expect(ctx.pdfDoc.getPageCount()).toBe(2);
    expect(ctx.pageNumber).toBe(2);
    expect(ctx.cursorY).toBe(ctx.height - ctx.margin);
  });

  it("addPage incrementa pageNumber", async () => {
    const ctx = await createPdfDocumentContext();
    addPage(ctx);
    expect(ctx.pageNumber).toBe(2);
    expect(ctx.pdfDoc.getPageCount()).toBe(2);
  });

  it("drawText avanza cursorY", async () => {
    const ctx = await createPdfDocumentContext();
    const before = ctx.cursorY;
    drawText(ctx, "Hola", { size: 10 });
    expect(ctx.cursorY).toBeLessThan(before);
  });
});

describe("drawInvestmentHero", () => {
  it("reserva altura fija para label y monto sin solaparse", async () => {
    const { createPdfDocumentContext } = await import("./context");
    const { drawInvestmentHero, measureInvestmentHeroHeight } = await import("./layout");

    const ctx = await createPdfDocumentContext({ accentColorHex: "#c27b3d" });
    const startY = ctx.cursorY;
    const height = measureInvestmentHeroHeight({ amountSize: 38 });

    drawInvestmentHero(ctx, "$ 1.072.825", {
      label: "Inversión estimada",
      amountSize: 38,
    });

    expect(ctx.cursorY).toBe(startY - height);
    expect(ctx.pdfDoc.getPageCount()).toBe(1);
  });
});

describe("resolvePdfLogo", () => {
  it("devuelve fallback con iniciales si no hay URL", async () => {
    const doc = await PDFDocument.create();
    const result = await resolvePdfLogo(doc, { fallbackLabel: "DnX Fotografía" });
    expect(result.kind).toBe("fallback");
    if (result.kind === "fallback") {
      expect(result.label).toBe("DF");
    }
  });

  it("no rompe si fetch falla", async () => {
    const doc = await PDFDocument.create();
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network"));
    const result = await resolvePdfLogo(doc, {
      logoUrl: "https://example.com/logo.png",
      fallbackLabel: "Estudio",
      fetchImpl,
    });

    expect(result.kind).toBe("fallback");
    if (result.kind === "fallback") {
      expect(result.label).toBe(commercialInitialsFromLabel("Estudio"));
    }
  });

  it("embebe PNG desde data URL", async () => {
    const doc = await PDFDocument.create();
    const dataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

    const result = await resolvePdfLogo(doc, {
      logoUrl: dataUrl,
      fallbackLabel: "Logo",
    });

    expect(result.kind).toBe("image");
  });

  it("prueba candidatos en orden hasta encontrar uno válido", async () => {
    const doc = await PDFDocument.create();
    const dataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network"));

    const result = await resolvePdfLogo(doc, {
      logoUrls: ["https://invalid.example/a.png", dataUrl],
      fallbackLabel: "Logo",
      fetchImpl,
    });

    expect(result.kind).toBe("image");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
