import { describe, expect, it } from "vitest";
import { suggestedDropMinor, validateTransfer } from "./transfer";

describe("suggestedDropMinor", () => {
  it("propone pasar todo lo que sobra del fondo fijo", () => {
    expect(suggestedDropMinor({ countedMinor: 47_300_00, fixedFloatMinor: 20_000_00 })).toBe(27_300_00);
  });

  it("si contaste justo el fondo fijo, no hay nada que pasar", () => {
    expect(suggestedDropMinor({ countedMinor: 20_000_00, fixedFloatMinor: 20_000_00 })).toBe(0);
  });

  it("si contaste menos que el fondo fijo, no propone un pase negativo", () => {
    expect(suggestedDropMinor({ countedMinor: 15_000_00, fixedFloatMinor: 20_000_00 })).toBe(0);
  });

  it("sin fondo fijo configurado propone pasar todo", () => {
    expect(suggestedDropMinor({ countedMinor: 47_300_00, fixedFloatMinor: 0 })).toBe(47_300_00);
  });
});

describe("validateTransfer", () => {
  const base = { fromAccountId: "diaria", toAccountId: "fuerte", fromBalanceMinor: 50_000_00 };

  it("un pase normal se acepta", () => {
    expect(validateTransfer({ ...base, amountMinor: 30_000_00 })).toEqual({ ok: true });
  });

  it("pasar todo el saldo se acepta", () => {
    expect(validateTransfer({ ...base, amountMinor: 50_000_00 })).toEqual({ ok: true });
  });

  it("no se pasa más de lo que hay en la cuenta de origen", () => {
    expect(validateTransfer({ ...base, amountMinor: 60_000_00 })).toEqual({
      ok: false,
      error: "No podés pasar más plata de la que hay en esa cuenta.",
    });
  });

  it("un importe de cero se rechaza", () => {
    expect(validateTransfer({ ...base, amountMinor: 0 })).toEqual({
      ok: false,
      error: "El importe tiene que ser mayor que cero.",
    });
  });

  it("un importe negativo se rechaza: el sentido lo dan las cuentas, no el signo", () => {
    expect(validateTransfer({ ...base, amountMinor: -100_00 })).toEqual({
      ok: false,
      error: "El importe tiene que ser mayor que cero.",
    });
  });

  it("no se pasa plata de una cuenta a sí misma", () => {
    expect(
      validateTransfer({ ...base, toAccountId: "diaria", amountMinor: 10_000_00 }),
    ).toEqual({ ok: false, error: "Elegí dos cuentas distintas." });
  });
});
