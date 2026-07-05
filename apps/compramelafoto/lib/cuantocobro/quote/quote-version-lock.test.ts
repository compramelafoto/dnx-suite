import { describe, expect, it } from "vitest";
import {
  assertQuoteVersionEditable,
  isQuoteVersionImmutable,
  quoteStatusAfterClientView,
} from "./quote-version-lock";

describe("quote-version-lock", () => {
  it("marca inmutable una versión vista por el cliente", () => {
    expect(isQuoteVersionImmutable({ firstViewedAt: null })).toBe(false);
    expect(isQuoteVersionImmutable({ firstViewedAt: new Date("2026-06-24T12:00:00.000Z") })).toBe(true);
  });

  it("bloquea edición cuando ya fue vista", () => {
    expect(() => assertQuoteVersionEditable({ firstViewedAt: new Date() })).toThrow(
      /creá una nueva versión/i,
    );
    expect(() => assertQuoteVersionEditable({ firstViewedAt: null })).not.toThrow();
  });

  it("pasa a VIEWED salvo ACCEPTED o REJECTED", () => {
    expect(quoteStatusAfterClientView("SENT")).toBe("VIEWED");
    expect(quoteStatusAfterClientView("DRAFT")).toBe("VIEWED");
    expect(quoteStatusAfterClientView("ACCEPTED")).toBe("ACCEPTED");
    expect(quoteStatusAfterClientView("REJECTED")).toBe("REJECTED");
  });
});
