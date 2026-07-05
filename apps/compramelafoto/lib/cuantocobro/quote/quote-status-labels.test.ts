import { describe, expect, it } from "vitest";
import { formatQuoteStatusLabel } from "./quote-status-labels";

describe("formatQuoteStatusLabel", () => {
  it("muestra archivado por encima del estado", () => {
    expect(formatQuoteStatusLabel("DRAFT", "2026-06-24T12:00:00.000Z")).toBe("Archivado");
  });

  it("traduce estados activos", () => {
    expect(formatQuoteStatusLabel("SENT", null)).toBe("Enviado");
    expect(formatQuoteStatusLabel("VIEWED", null)).toBe("Visto por el cliente");
    expect(formatQuoteStatusLabel("ACCEPTED", null)).toBe("Aceptado");
  });
});
