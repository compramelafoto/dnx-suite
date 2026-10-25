import { describe, expect, it } from "vitest";
import { canAddOpeningBalance } from "./opening-balance-rules";

describe("canAddOpeningBalance", () => {
  it("sin saldo inicial vigente, se puede cargar", () => {
    expect(canAddOpeningBalance(undefined)).toEqual({ ok: true });
  });

  it("con uno vigente, se rechaza y explica cómo corregirlo", () => {
    expect(canAddOpeningBalance({ movementId: "m", amountMinor: 1, occurredAt: new Date() })).toEqual({
      ok: false,
      error: "Esta cuenta ya tiene saldo inicial. Para corregirlo, anulalo en Movimientos y cargalo de nuevo.",
    });
  });
});
