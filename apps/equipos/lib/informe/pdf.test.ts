import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/db", () => ({ prisma: {} }));
import { PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { buildInsuranceReportPdf, formatMoney, maskDni, toWinAnsi } from "./pdf";
import type { ReportSnapshot } from "./snapshot";

const snapshot = (over: Partial<ReportSnapshot> = {}): ReportSnapshot => ({
  issuedAt: "2026-11-25T15:00:00.000Z",
  holder: { legalName: "Ana Peña — “Niño” 😀", documentLast3: "456" },
  items: [
    {
      kind: "BODY",
      make: "Canon",
      model: "R5 ¿ñandú?",
      serialRaw: "AB-123",
      status: "IN_USE",
      purchaseDate: "2025-03-01",
      hasPurchaseProof: true,
      seal: { photosCount: 40, since: "2024-05-02" },
      valueArs: 4000000,
      valueUsd: 3500,
    },
  ],
  totalArs: 4000000,
  totalUsd: 3500,
  ...over,
});

async function contenido(bytes: Uint8Array): Promise<string> {
  const doc = await PDFDocument.load(bytes);
  let out = "";
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFRawStream) {
      const filter = obj.dict.get(PDFName.of("Filter"));
      const data = filter ? decodePDFRawStream(obj).decode() : obj.contents;
      out += Buffer.from(data).toString("latin1") + "\n";
    }
  }
  return out;
}
const hex = (s: string) => Buffer.from(s, "latin1").toString("hex").toUpperCase();

describe("helpers", () => {
  it("maskDni deja sólo los últimos 3", () => {
    expect(maskDni("456")).toBe("**.***.456");
    expect(maskDni("12345678")).toBe("**.***.678");
  });
  it("formatMoney usa separador de miles, sin decimales", () => {
    expect(formatMoney(4000000)).toBe("4.000.000");
    expect(formatMoney(950)).toBe("950");
  });
  it("toWinAnsi conserva acentos y ñ y descarta lo que no entra", () => {
    expect(toWinAnsi("áéíóú ñ ¿¡")).toBe("áéíóú ñ ¿¡");
    expect(toWinAnsi("Niño 😀 — “ok”")).not.toMatch(/😀/);
  });
});

describe("buildInsuranceReportPdf", () => {
  it("genera un PDF con 1+ páginas y el DNI enmascarado", async () => {
    const bytes = await buildInsuranceReportPdf(snapshot(), "https://equipos.test/informe/abc");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(await contenido(bytes)).toContain(hex("**.***.456"));
  });

  it("no revienta con caracteres fuera de WinAnsi", async () => {
    await expect(
      buildInsuranceReportPdf(snapshot(), "https://equipos.test/informe/abc"),
    ).resolves.toBeInstanceOf(Uint8Array);
  });

  it("pagina cuando hay muchos equipos", async () => {
    const item = snapshot().items[0];
    const bytes = await buildInsuranceReportPdf(
      snapshot({ items: Array.from({ length: 40 }, () => item) }),
      "https://equipos.test/informe/abc",
    );
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(1);
  });
});
