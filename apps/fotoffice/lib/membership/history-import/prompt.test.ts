import { describe, expect, it } from "vitest";
import { PAYMENT_IMPORT_COLUMNS, PAYMENT_IMPORT_HEADER_ROW } from "./columns";
import { buildPaymentImportPrompt } from "./prompt";

describe("buildPaymentImportPrompt", () => {
  const prompt = buildPaymentImportPrompt({ workspaceName: "SFPR" });

  it("pide exactamente el encabezado que después se valida", () => {
    expect(prompt).toContain(PAYMENT_IMPORT_HEADER_ROW);
  });

  it("describe todas las columnas declaradas, sin olvidarse ninguna", () => {
    for (const c of PAYMENT_IMPORT_COLUMNS) expect(prompt).toContain(c.key);
  });

  it("deja claro que una fila es un pago, no un socio", () => {
    expect(prompt).toMatch(/una fila por PAGO/i);
  });

  it("le prohíbe agregar socios: el padrón ya está completo", () => {
    expect(prompt).toMatch(/NO agregues socios/i);
  });

  it("no filtra datos del padrón a un servicio externo", () => {
    // Sólo el nombre de la institución y el formato. Nada de socios, números ni importes.
    expect(prompt).toContain("SFPR");
    expect(prompt).not.toMatch(/\bDNI\b/);
  });
});
